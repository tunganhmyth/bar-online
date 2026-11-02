import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { TikTokBridge, resolveTikTokUsername } from './live-bridge.mjs';

class FakeConnection extends EventEmitter {
  async connect() { return { roomId: '123456' }; }
  async disconnect() { this.emit('disconnected'); }
}

test('resolves usernames, live URLs and TikTok short redirects', async () => {
  assert.equal(await resolveTikTokUsername('@some.creator'), 'some.creator');
  assert.equal(await resolveTikTokUsername('https://www.tiktok.com/@some.creator/live?x=1'), 'some.creator');
  assert.equal(await resolveTikTokUsername('vt.tiktok.com/abc', async () => new Response(null, {
    status: 302, headers: { location: 'https://www.tiktok.com/@some.creator/live' }
  })), 'some.creator');
  await assert.rejects(resolveTikTokUsername('https://example.com/@test'), /TikTok/);
  await assert.rejects(resolveTikTokUsername('bad user'), /Username/);
  await assert.rejects(resolveTikTokUsername('https://vt.tiktok.com/abc', async () => new Response(null, {
    status: 302, headers: { location: 'https://example.com/@test' }
  })), /TikTok/);
});

test('normalizes current and legacy event payloads for the dance floor', async () => {
  const connection = new FakeConnection();
  const bridge = new TikTokBridge(() => connection);
  const events = [];
  bridge.on('event', (event) => events.push(event));
  await bridge.connect('@creator');
  assert.equal(bridge.state.connected, true);
  assert.equal(bridge.state.roomId, '123456');
  connection.emit('chat', { user: { uniqueId: 'viewer', nickname: 'Người xem' }, content: 'Xin chào' });
  connection.emit('member', { uniqueId: 'legacy', nickname: 'Old payload' });
  connection.emit('roomUser', { total: 0 });
  assert.equal(events.find((event) => event.type === 'chat').data.comment, 'Xin chào');
  assert.equal(events.find((event) => event.type === 'chat').data.uniqueId, 'viewer');
  assert.equal(events.find((event) => event.type === 'member').data.uniqueId, 'legacy');
  assert.equal(bridge.state.viewerCount, 0);
  await bridge.disconnect();
  connection.emit('chat', { uniqueId: 'ignored', comment: 'stale' });
  assert.equal(events.filter((event) => event.type === 'chat').length, 1);
  assert.equal(bridge.state.connected, false);
});

test('gift streaks count increments once and ignore the repeated final frame', async () => {
  const connection = new FakeConnection();
  const bridge = new TikTokBridge(() => connection);
  const gifts = [];
  bridge.on('event', (event) => { if (event.type === 'gift') gifts.push(event.data); });
  await bridge.connect('creator');
  const gift = { user: { uniqueId: 'viewer' }, giftId: 1, giftType: 1, groupId: 'combo', diamondCount: 2 };
  // v3 nests gift metadata; the older payload exposes giftType at top level.
  connection.emit('gift', { ...gift, giftType: undefined, gift: { type: 1, diamondCount: 2 }, repeatCount: 1 });
  connection.emit('gift', { ...gift, repeatCount: 3 });
  connection.emit('gift', { ...gift, repeatCount: 3, repeatEnd: true });
  assert.deepEqual(gifts.map((event) => event.count), [1, 2]);
  assert.equal(gifts.reduce((total, event) => total + event.diamonds, 0), 6);
  await bridge.disconnect();
});

test('a late connection completion cannot reconnect after disconnect', async () => {
  let finish;
  const connection = new FakeConnection();
  connection.connect = () => new Promise((resolve) => { finish = resolve; });
  const bridge = new TikTokBridge(() => connection);
  const pending = bridge.connect('creator');
  // Allow username resolution and connection creation to finish.
  await new Promise((resolve) => setImmediate(resolve));
  await bridge.disconnect();
  finish({ roomId: 'late-room' });
  await pending;
  assert.equal(bridge.state.connected, false);
  assert.equal(bridge.state.roomId, null);
});

test('switching channels ignores events from the previous channel', async () => {
  const first = new FakeConnection();
  const second = new FakeConnection();
  const bridge = new TikTokBridge((user) => user === 'first' ? first : second);
  const chats = [];
  bridge.on('event', (event) => { if (event.type === 'chat') chats.push(event); });
  await bridge.connect('first');
  await bridge.connect('second');
  first.emit('chat', { comment: 'stale' });
  second.emit('chat', { comment: 'current' });
  assert.deepEqual(chats.map((event) => event.data.comment), ['current']);
  assert.equal(bridge.state.username, 'second');
  await bridge.disconnect();
});

test('offline/error state is visible and the connector can retry', async () => {
  const connection = new FakeConnection();
  connection.connect = async () => { throw new Error('The user is not live'); };
  const bridge = new TikTokBridge(() => connection);
  await bridge.connect('offline');
  assert.equal(bridge.state.connected, false);
  assert.equal(bridge.state.connecting, false);
  assert.match(bridge.state.lastError, /not live/);
  connection.connect = async () => ({ roomId: 'retry' });
  await bridge.connect('offline');
  assert.equal(bridge.state.connected, true);
  assert.equal(bridge.state.lastError, null);
  await bridge.disconnect();
});
