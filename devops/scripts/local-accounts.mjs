import { readFile } from 'node:fs/promises';
import { ensureLocalSettings } from '../local/settings.mjs';
await ensureLocalSettings();
console.log(await readFile('.local/LOCAL-ACCESS.md', 'utf8'));
