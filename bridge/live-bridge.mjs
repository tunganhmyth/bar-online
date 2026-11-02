// Adapted from tiktok-live-temple-rpc-main/server.js: username resolution,
// TikTokLiveConnection options, user extraction and WebcastEvent handlers.
import { EventEmitter } from 'node:events';
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';

const allowedHost = (hostname) => hostname === 'tiktok.com' || hostname.endsWith('.tiktok.com');
const validUsername = (username) => /^[a-zA-Z0-9_.]{1,24}$/.test(username);

export async function resolveTikTokUsername(rawInput, fetcher = fetch) {
  let input = String(rawInput || '').trim();
  if (!input || input.length > 512) throw new Error('Nhập @username hoặc link TikTok Live hợp lệ.');
  if (/^(?:https?:\/\/|(?:www\.|vt\.|vm\.)?tiktok\.com\/)/i.test(input)) {
    let url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    for (let redirects = 0; redirects < 6; redirects++) {
      if (url.protocol !== 'https:' || !allowedHost(url.hostname) || url.username || url.password || url.port) {
        throw new Error('Chỉ hỗ trợ đường dẫn HTTPS của TikTok.');
      }
      const match = url.pathname.match(/^\/@([^/]+)/);
      if (match && validUsername(match[1])) return match[1];
      const response = await fetcher(url, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
      // Only the redirect target is needed; do not download a video/page body.
      await response.body?.cancel();
      const location = response.headers.get('location');
      if (response.status < 300 || response.status >= 400 || !location) break;
      url = new URL(location, url);
    }
    throw new Error('Không tìm thấy username. Hãy nhập trực tiếp @username của người đang live.');
  }
  input = input.replace(/^@/, '');
  if (!validUsername(input)) throw new Error('Username TikTok chỉ gồm chữ, số, dấu chấm và gạch dưới (tối đa 24 ký tự).');
  return input;
}

export function extractUserFromEvent(data) {
  const user = data?.user || data || {};
  const uniqueId = String(user.uniqueId || user.displayId || data?.uniqueId || user.id || 'viewer');
  return {
    uniqueId,
    nickname: String(user.nickname || data?.nickname || uniqueId),
    avatar: user.profilePictureUrl || user.avatarThumb?.urlList?.[0] || data?.profilePictureUrl || ''
  };
}

export class TikTokBridge extends EventEmitter {
  constructor(createConnection = (username, options) => new TikTokLiveConnection(username, options)) {
    super();
    this.createConnection = createConnection;
    this.connection = null;
    this.generation = 0;
    this.giftCombos = new Map();
    this.state = { connected: false, connecting: false, username: '', roomId: null, viewerCount: 0, lastError: null };
  }

  publish(type, data) { this.emit('event', { type, data }); }
  publishState() { this.publish('state', { ...this.state }); }

  async releaseConnection() {
    const previous = this.connection;
    this.connection = null;
    this.giftCombos.clear();
    if (previous) {
      try { await previous.disconnect(); } catch { /* Connection may already be closed. */ }
    }
  }

  async connect(rawInput) {
    // Advance before resolving short links so disconnect/switch cancels old attempts.
    const generation = ++this.generation;
    await this.releaseConnection();
    if (generation !== this.generation) return;
    this.state = { connected: false, connecting: true, username: '', roomId: null, viewerCount: 0, lastError: null };
    this.publishState();
    let connection;
    try {
      const username = await resolveTikTokUsername(rawInput);
      if (generation !== this.generation) return;
      this.state.username = username;
      this.publishState();
      connection = this.createConnection(username, {
        processInitialData: false,
        fetchRoomInfoOnConnect: false,
        enableExtendedGiftInfo: false
      });
      this.connection = connection;
      const current = () => generation === this.generation && this.connection === connection;
      const listen = (event, handler) => connection.on(event, (data) => { if (current()) handler(data); });

      listen(ControlEvent.CONNECTED, (room) => {
        Object.assign(this.state, { connected: true, connecting: false, roomId: String(room?.roomId || connection.roomId || ''), lastError: null });
        this.publishState();
      });
      listen(ControlEvent.DISCONNECTED, () => {
        Object.assign(this.state, { connected: false, connecting: false, viewerCount: 0 });
        this.publishState();
      });
      listen(ControlEvent.ERROR, (error) => {
        this.state.lastError = error?.message || error?.exception?.message || 'Lỗi kết nối TikTok Live.';
        this.publishState();
      });
      listen(WebcastEvent.STREAM_END, () => {
        Object.assign(this.state, { connected: false, connecting: false, viewerCount: 0, lastError: 'Buổi live đã kết thúc.' });
        this.publishState();
      });
      listen(WebcastEvent.ROOM_USER, (data) => {
        this.state.viewerCount = Math.max(0, Number(data?.total ?? data?.viewerCount ?? 0) || 0);
        this.publishState();
      });
      listen(WebcastEvent.MEMBER, (data) => this.publish('member', extractUserFromEvent(data)));
      listen(WebcastEvent.CHAT, (data) => this.publish('chat', {
        ...extractUserFromEvent(data), comment: String(data?.content || data?.comment || '')
      }));
      listen(WebcastEvent.LIKE, (data) => this.publish('like', {
        ...extractUserFromEvent(data), count: Math.max(1, Number(data?.count ?? data?.likeCount ?? 1) || 1)
      }));
      listen(WebcastEvent.FOLLOW, (data) => this.publish('follow', extractUserFromEvent(data)));
      listen(WebcastEvent.SHARE, (data) => this.publish('share', extractUserFromEvent(data)));
      // Connector 2.5 emits FOLLOW/SHARE from SOCIAL; subscribing to both duplicates them.
      listen(WebcastEvent.GIFT, (data) => this.handleGift(data));

      const room = await connection.connect();
      if (!current()) {
        try { await connection.disconnect(); } catch { /* A newer request owns the state. */ }
        return;
      }
      Object.assign(this.state, { connected: true, connecting: false, roomId: String(room?.roomId || connection.roomId || ''), lastError: null });
      this.publishState();
    } catch (error) {
      if (generation !== this.generation) return;
      await this.releaseConnection();
      if (generation !== this.generation) return;
      Object.assign(this.state, {
        connected: false, connecting: false, viewerCount: 0,
        lastError: error?.message || 'Không thể kết nối. Kiểm tra tài khoản có đang live không.'
      });
      this.publishState();
    }
  }

  handleGift(data) {
    const user = extractUserFromEvent(data);
    const gift = data?.gift || data?.giftDetails || {};
    const giftId = String(data?.giftId || gift.id || 'gift');
    const comboKey = `${user.uniqueId}:${giftId}:${data?.groupId || ''}`;
    const repeatCount = Math.max(1, Number(data?.repeatCount || data?.comboCount || 1) || 1);
    const streak = Number(data?.giftType ?? gift.type ?? gift.giftType) === 1;
    let count = repeatCount;
    if (streak) {
      const previous = this.giftCombos.get(comboKey) || 0;
      count = Math.max(0, repeatCount - previous);
      this.giftCombos.set(comboKey, repeatCount);
      if (data?.repeatEnd) this.giftCombos.delete(comboKey);
      if (this.giftCombos.size > 500) this.giftCombos.delete(this.giftCombos.keys().next().value);
    }
    if (!count) return;
    this.publish('gift', {
      ...user, giftId, count,
      giftName: String(gift.name || data?.giftName || gift.describe || 'Quà tặng'),
      diamonds: Math.max(0, Number(gift.diamondCount ?? data?.diamondCount ?? 0) || 0) * count
    });
  }

  async disconnect() {
    const generation = ++this.generation;
    await this.releaseConnection();
    if (generation !== this.generation) return;
    Object.assign(this.state, { connected: false, connecting: false, viewerCount: 0, roomId: null, lastError: null });
    this.publishState();
  }
}
