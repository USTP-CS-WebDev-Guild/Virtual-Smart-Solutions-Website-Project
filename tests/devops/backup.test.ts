import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exportApplicationSql } from '../../devops/scripts/backup-export.mjs';

describe('recoverable application exports', () => {
  it('includes actual application records as well as table structure', () => {
    const directory = mkdtempSync(join(tmpdir(), 'student-export-test-'));
    try {
      const run = (_command: string, args: string[]) => {
        expect(args[args.indexOf('--schema') + 1]).toBe('public,app_private');
        if (args.includes('--data-only'))
          expect(args[args.indexOf('--exclude') + 1]).toBe('app_private.staff_sessions,public.staff_users');
        const output = args[args.indexOf('--file') + 1];
        const sql = args.includes('--data-only')
          ? "INSERT INTO public.inquiries(id, name) VALUES ('synthetic-1', 'Test Contact');"
          : 'CREATE TABLE public.inquiries(id text, name text);';
        writeFileSync(output, sql);
        return { status: 0 };
      };
      const dump = exportApplicationSql('test-connection', directory, run as any).toString();
      expect(dump).toContain('CREATE TABLE public.inquiries');
      expect(dump).toContain("VALUES ('synthetic-1', 'Test Contact')");
      expect(dump).toContain('REVOKE ALL ON TABLES FROM anon, authenticated');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('fails instead of returning a schema-only backup when record export fails', () => {
    const directory = mkdtempSync(join(tmpdir(), 'student-export-fail-'));
    try {
      const run = (_command: string, args: string[]) => {
        if (args.includes('--data-only')) return { status: 1 };
        writeFileSync(args[args.indexOf('--file') + 1], 'CREATE TABLE public.inquiries(id text);');
        return { status: 0 };
      };
      expect(() => exportApplicationSql('test-connection', directory, run as any)).toThrow(
        'data export failed',
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
