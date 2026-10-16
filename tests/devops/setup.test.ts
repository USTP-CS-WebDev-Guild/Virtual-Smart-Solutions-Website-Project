import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('student setup preserves local configuration', () => {
  it('creates a random secret once and keeps existing account values on rerun', () => {
    const directory = mkdtempSync(join(tmpdir(), 'student-setup-'));
    const setup = fileURLToPath(new URL('../../devops/scripts/setup.mjs', import.meta.url));
    try {
      writeFileSync(join(directory, '.env.example'), 'RATE_LIMIT_SECRET=\nSUPABASE_URL=\n');
      const first = spawnSync(process.execPath, [setup], { cwd: directory, encoding: 'utf8' });
      expect(first.status).toBe(0);
      const generated = readFileSync(join(directory, '.env'), 'utf8');
      expect(generated).toMatch(/RATE_LIMIT_SECRET=[A-Za-z0-9_-]{40,}/);
      const custom = generated.replace(
        'SUPABASE_URL=',
        'SUPABASE_URL=https://synthetic.supabase.co',
      );
      writeFileSync(join(directory, '.env'), custom);
      const second = spawnSync(process.execPath, [setup], { cwd: directory, encoding: 'utf8' });
      expect(second.status).toBe(0);
      expect(readFileSync(join(directory, '.env'), 'utf8')).toBe(custom);
      expect(second.stdout).not.toContain(custom);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
