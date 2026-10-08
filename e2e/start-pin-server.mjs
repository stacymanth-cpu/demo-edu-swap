// Starts the real EduSwap server (login PINs + call tokens) against the Firebase emulators
// and copies its output to e2e/.output/pin-server.log, where the tests read each login PIN.
// With no SMTP settings the server prints PINs instead of emailing them.
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error('Run the browser tests with `npm run test:e2e` so the Firebase emulators are running.');
  process.exit(1);
}

mkdirSync('e2e/.output', { recursive: true });
const log = createWriteStream('e2e/.output/pin-server.log', { flags: 'w' });

const env = {
  ...process.env,
  GCLOUD_PROJECT: 'demo-eduswap',
  LIVEKIT_API_KEY: 'e2e-key',
  LIVEKIT_API_SECRET: 'e2e-secret-e2e-secret-e2e-secret-00',
};
// Never send real email or use real credentials from the developer's shell, and listen on
// LIVEKIT_TOKEN_PORT rather than any PORT the shell sets.
for (const name of ['SMTP_USER', 'SMTP_PASS', 'BREVO_API_KEY', 'MAIL_FROM', 'GOOGLE_APPLICATION_CREDENTIALS', 'PORT']) delete env[name];

const server = spawn('npx', ['tsx', 'server/livekitTokenServer.ts'], { env, shell: true });
for (const stream of [server.stdout, server.stderr]) {
  stream.on('data', chunk => {
    log.write(chunk);
    process.stdout.write(chunk);
  });
}
server.on('exit', code => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal));
