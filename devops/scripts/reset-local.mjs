import { rename, mkdir, readFile } from 'node:fs/promises';
import { ensureLocalSettings } from '../local/settings.mjs';
if (!process.argv.includes('--confirm-local-data'))
  throw new Error(
    'This starts an empty classroom database and new local accounts. Stop npm run dev, then use npm run reset:local -- --confirm-local-data. The old local folder is archived, not deleted.',
  );
try {
  const pid = Number(await readFile('.local/server.lock', 'utf8'));
  let running = false;
  try {
    process.kill(pid, 0);
    running = true;
  } catch {}
  if (running) throw new Error('Stop npm run dev with Ctrl+C before resetting.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await mkdir('.classroom-backups', { recursive: true });
const archive = '.classroom-backups/' + new Date().toISOString().replaceAll(':', '-');
try {
  await rename('.local', archive);
  console.log('Previous local data archived in ' + archive);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await ensureLocalSettings();
console.log('Fresh classroom ready. Use npm run accounts for the new local passwords.');
