import { createInterface } from 'node:readline';
import { TikTokBridge } from './live-bridge.mjs';

// stdout is a JSON-lines channel read by Spring Boot. Keep library logs on stderr.
console.log = (...args) => console.error(...args);
const bridge = new TikTokBridge();
bridge.on('event', (event) => process.stdout.write(`${JSON.stringify(event)}\n`));
bridge.publishState();
const input = createInterface({ input: process.stdin });
input.on('line', (line) => {
  try {
    const command = JSON.parse(line);
    if (command.action === 'connect') void bridge.connect(command.username);
    else if (command.action === 'disconnect') void bridge.disconnect();
  } catch (error) {
    console.error('[TikTok bridge]', error.message);
  }
});
input.on('close', async () => { await bridge.disconnect(); process.exit(0); });
process.on('SIGTERM', async () => { await bridge.disconnect(); process.exit(0); });
