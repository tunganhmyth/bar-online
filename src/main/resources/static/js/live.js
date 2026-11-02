(() => {
  'use strict';
  const form = document.getElementById('connect-form');
  const username = document.getElementById('username');
  const connectButton = document.getElementById('connect');
  const disconnectButton = document.getElementById('disconnect');
  const status = document.getElementById('status');
  const error = document.getElementById('error');
  const stage = document.getElementById('wutai');
  const loader = document.getElementById('scene-loader');
  const mode = document.getElementById('stage-mode');
  const giftFeature = document.getElementById('gift-feature');
  let connectedUser = '';
  let isConnected = false;
  let activityTimer;
  let sourceAvailable = false;
  let club;

  function announce(text) {
    const activity = document.getElementById('activity');
    clearTimeout(activityTimer);
    activity.textContent = text;
    activityTimer = setTimeout(() => { activity.textContent = ''; }, 4000);
  }
  function showError(message) { error.textContent = message || ''; error.hidden = !message; }

  stage.addEventListener('club:ready', () => { loader.hidden = true; });
  stage.addEventListener('club:error', (event) => {
    loader.querySelector('strong').textContent = event.detail.message;
    loader.querySelector('small').textContent = 'Kiểm tra kết nối và bật tăng tốc phần cứng cho trình duyệt.';
    loader.querySelector('.loader-ring').hidden = true;
    console.error(event.detail.detail);
  });
  stage.addEventListener('club:participants', (event) => { document.getElementById('dancer-count').textContent = event.detail.count; });
  stage.addEventListener('club:gift', (event) => {
    const { user, gift, preview } = event.detail;
    document.getElementById('gift-user').textContent = user.nickname || user.uniqueId;
    document.getElementById('gift-description').textContent = `${gift.count || 1} × ${gift.giftName || 'Quà tặng'} · Cảm ơn bạn đã tỏa sáng!`;
    document.getElementById('gift-caption').textContent = preview ? 'XEM THỬ · CAMERA QUÀ TẶNG' : 'TÂM ĐIỂM ĐÊM NAY';
    giftFeature.hidden = false;
    giftFeature.style.animation = 'none'; void giftFeature.offsetWidth; giftFeature.style.animation = '';
    const progress = giftFeature.querySelector('.gift-progress');
    progress.style.animation = 'none'; void progress.offsetWidth; progress.style.animation = '';
    document.getElementById('camera-status').textContent = 'CẬN CẢNH · NGƯỜI TẶNG QUÀ';
  });
  stage.addEventListener('club:gift-end', () => {
    giftFeature.hidden = true;
    document.getElementById('camera-status').textContent = 'GÓC MÁY TOÀN SÀN';
  });
  try {
    club = window.createClubScene(stage);
    window.clubScene = club;
  } catch (failure) {
    loader.querySelector('strong').textContent = 'Không khởi tạo được sân khấu 3D';
    loader.querySelector('small').textContent = 'Hãy bật tăng tốc phần cứng và tải lại trang.';
    loader.querySelector('.loader-ring').hidden = true;
    console.error(failure);
  }

  function updateState(state) {
    isConnected = Boolean(state.connected);
    connectButton.disabled = Boolean(state.connecting);
    disconnectButton.disabled = !state.connected && !state.connecting;
    document.getElementById('preview').disabled = state.connected || state.connecting;
    status.classList.toggle('connected', isConnected);
    status.textContent = state.connecting ? `Đang kết nối ${state.username ? '@' + state.username : 'TikTok'}…`
      : isConnected ? `Đã kết nối @${state.username}` : 'Chưa kết nối TikTok';
    document.getElementById('viewers').textContent = `${Number(state.viewerCount) || 0} người xem`;
    showError(state.lastError);
    mode.textContent = isConnected ? '● LIVE' : club?.getSnapshot().preview ? 'XEM THỬ' : 'ĐÃ NGẮT LIVE';
    mode.classList.toggle('is-live', isConnected);
    if (state.username && !username.value) username.value = '@' + state.username;
    if (isConnected && connectedUser !== state.username) {
      connectedUser = state.username;
      club?.setPreview(false);
      club?.addParticipant({ uniqueId: 'host:' + state.username, nickname: '@' + state.username });
    }
  }
  async function request(action, body) {
    const response = await fetch('/api/live/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Không gửi được yêu cầu.');
    return result;
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!sourceAvailable) { showError('Đang chờ kết nối với server. Vui lòng thử lại sau.'); return; }
    showError(''); connectButton.disabled = true;
    try { await request('connect', { username: username.value.trim() }); }
    catch (failure) { showError(failure.message); connectButton.disabled = false; }
  });
  disconnectButton.addEventListener('click', async () => {
    try { await request('disconnect'); } catch (failure) { showError(failure.message); }
  });

  function handleEvent(event) {
    const data = event.data;
    if (event.type === 'state') { updateState(data); return; }
    if (!club) return;
    if (event.type === 'member') { club.addParticipant(data); return; }
    if (event.type === 'chat') {
      const command = String(data.comment || '').trim().toLocaleLowerCase('vi');
      if (['đổi đồ', 'doi do', 'đổi nhân vật', 'doi nhan vat', 'đổi chó', 'doi cho', 'đổi cún', 'doi cun', '换修勾'].includes(command)) {
        club.addParticipant(data); const palette = club.changeAvatar(data.uniqueId);
        club.showMessage(data, `Phong cách ${palette || 'mới'}!`);
      } else club.showMessage(data, data.comment);
    } else if (event.type === 'gift') club.focusGift(data, data);
    else if (event.type === 'like') club.react(data, `♥ +${data.count}`);
    else if (event.type === 'follow') club.react(data, '★ Đã theo dõi');
    else if (event.type === 'share') club.react(data, '↗ Đã chia sẻ');
  }
  const events = new EventSource('/api/live/events');
  let openedBefore = false;
  events.onopen = () => {
    sourceAvailable = true;
    if (!openedBefore && username.value && new URLSearchParams(location.search).get('connect') === '1') form.requestSubmit();
    openedBefore = true;
  };
  events.onmessage = (message) => {
    try { handleEvent(JSON.parse(message.data)); } catch (failure) { console.error('Không đọc được sự kiện live:', failure); }
  };
  events.onerror = () => {
    sourceAvailable = false; status.textContent = 'Mất kết nối server, đang thử lại…';
    status.classList.remove('connected'); disconnectButton.disabled = true;
  };

  document.getElementById('preview').addEventListener('click', () => {
    if (isConnected) return;
    connectedUser = ''; club?.setPreview(true); mode.textContent = 'XEM THỬ';
  });
  document.getElementById('test-gift').addEventListener('click', () => club?.testGift());
  document.getElementById('change-avatar').addEventListener('click', () => {
    const palette = club?.changeAvatar(); if (palette) announce('Phong cách ' + palette);
  });
  document.getElementById('camera-reset').addEventListener('click', () => club?.resetCamera());
  document.getElementById('camera-orbit').addEventListener('click', (event) => event.currentTarget.setAttribute('aria-pressed', String(club?.toggleOrbit() || false)));
  document.getElementById('lights-toggle').addEventListener('click', (event) => event.currentTarget.setAttribute('aria-pressed', String(club?.toggleLights() || false)));
  document.getElementById('fullscreen').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else stage.requestFullscreen?.().catch(() => announce('Không mở được chế độ toàn màn hình.'));
  });
  function setLayout(layout) {
    document.body.classList.toggle('is-wide', layout === 'wide');
    document.querySelectorAll('[data-layout]').forEach((button) => {
      const selected = button.dataset.layout === layout;
      button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected));
    });
  }
  document.querySelectorAll('[data-layout]').forEach((button) => button.addEventListener('click', () => setLayout(button.dataset.layout)));
  const query = new URLSearchParams(location.search);
  if (query.get('layout') === 'wide') setLayout('wide');
  if (query.get('obs') === '1') {
    document.body.classList.add('obs');
    const show = document.getElementById('show-controls'); show.hidden = false;
    show.addEventListener('click', () => { document.body.classList.remove('obs'); show.hidden = true; });
  }

  const music = document.getElementById('music');
  const enableMusic = document.getElementById('enable-music');
  music.src = '/music/YTSave.to_YouTube_Media_7f-49jDbK10_NONSTOP-VINAHOUSE-2025-VÀO-PHÒNG-BAY-PHẢI-MỞ-BÀI-NÀY-NHẠC-SÀN-BAY-PHÒNG-BASS-CĂN_009_vbr.mp3';
  music.volume = 0.4; music.autoplay = true; music.loop = true;
  function hideMusicPrompt() {
    enableMusic.hidden = true;
    document.removeEventListener('pointerdown', startMusic); document.removeEventListener('keydown', startMusic);
  }
  async function startMusic() {
    try { await music.play(); hideMusicPrompt(); }
    catch (failure) {
      if (failure.name === 'NotAllowedError') {
        enableMusic.hidden = false;
        document.addEventListener('pointerdown', startMusic); document.addEventListener('keydown', startMusic);
      }
    }
  }
  music.addEventListener('play', hideMusicPrompt);
  enableMusic.addEventListener('click', startMusic);
  music.addEventListener('error', () => { hideMusicPrompt(); announce('Không tải được nhạc nền. Hãy tải lại trang để thử lại.'); });
  void startMusic();
})();
