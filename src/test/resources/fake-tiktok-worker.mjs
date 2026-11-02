// Local fixture only: used by Spring integration tests, never by the default app.
import { createInterface } from 'node:readline';
const send = (type, data) => process.stdout.write(JSON.stringify({ type, data }) + '\n');
createInterface({ input: process.stdin }).on('line', (line) => {
  const command = JSON.parse(line);
  if (command.action === 'connect') {
    send('state', { connected: true, connecting: false, username: command.username.replace(/^@/, ''), roomId: 'fixture-room', viewerCount: 12, lastError: null });
    send('chat', { uniqueId: 'viewer', nickname: 'Người xem', comment: 'Xin chào TikTok' });
    if (command.username.replace(/^@/, '') === 'scene_test') {
      send('member', { uniqueId: 'second-viewer', nickname: 'Khách thứ hai' });
      setTimeout(() => send('gift', { uniqueId: 'viewer', nickname: 'Người xem', giftName: 'Hoa hồng', count: 5, diamonds: 5 }), 800);
      setTimeout(() => send('gift', { uniqueId: 'second-viewer', nickname: 'Khách thứ hai', giftName: 'Trái tim', count: 1, diamonds: 10 }), 1200);
    }
  } else send('state', { connected: false, connecting: false, username: '', roomId: null, viewerCount: 0, lastError: null });
}).on('close', () => process.exit(0));
