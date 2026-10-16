import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

// Keep the frontend attached to this terminal; Ctrl+C stops it.
// The full-system start script manages both child processes.
const require = createRequire(import.meta.url);
const astroBin = resolve(dirname(require.resolve('astro/package.json')), 'bin/astro.mjs');
const server = spawn(
  process.execPath,
  [astroBin, 'dev', '--ignore-lock', '--host', '127.0.0.1', '--port', '4321'],
  {
    stdio: 'inherit',
    env: { ...process.env, ASTRO_DEV_BACKGROUND: '0' },
  },
);

server.on('error', (error) => {
  console.error(`Could not start Astro: ${error.message}`);
  process.exitCode = 1;
});

server.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.kill(signal));
}
