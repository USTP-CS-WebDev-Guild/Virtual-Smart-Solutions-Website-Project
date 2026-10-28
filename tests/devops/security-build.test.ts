import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
const script=fileURLToPath(new URL('../../devops/scripts/security-build.mjs',import.meta.url));
function fixture() {
  const root=mkdtempSync(join(tmpdir(),'vss-policy-'));
  mkdirSync(join(root,'frontend/public'),{recursive:true}); mkdirSync(join(root,'dist'));
  writeFileSync(join(root,'frontend/public/_headers'),"/*\n  Content-Security-Policy: default-src 'self'\n/admin/*\n  Cache-Control: no-store\n");
  const run=(extra:Record<string,string>={})=>spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8',env:{...process.env,PUBLIC_SUPABASE_URL:'https://example.supabase.co',PUBLIC_HCAPTCHA_SITE_KEY:'',...extra}});
  return {root,run};
}
describe('deployment-specific browser policy',()=>{
  it('allows one project and the explicitly enabled verification provider without unsafe script execution',()=>{
    const f=fixture(); try{
      expect(f.run({PUBLIC_HCAPTCHA_SITE_KEY:'synthetic-sitekey'}).status).toBe(0);
      const headers=readFileSync(join(f.root,'dist/_headers'),'utf8');
      expect(headers).toContain('https://example.supabase.co wss://example.supabase.co');
      expect(headers).not.toContain('*.supabase.co');
      expect(headers).not.toMatch(/unsafe-inline|unsafe-eval/);
      expect(headers).toContain('https://*.hcaptcha.com');
      expect(headers).toContain('Cache-Control: no-store');
    }finally{rmSync(f.root,{recursive:true,force:true});}
  });
  it('rejects a configuration URL that could expand the network allowlist',()=>{
    const f=fixture();try{ expect(f.run({PUBLIC_SUPABASE_URL:'https://attacker.example/path'}).status).not.toBe(0); }
    finally{rmSync(f.root,{recursive:true,force:true});}
  });
  it('fails a build that embeds an actual configured secret into a public asset without printing its value',()=>{
    const f=fixture(); const key='synthetic-private-value-for-build-check';
    try{
      writeFileSync(join(f.root,'dist/leak.js'),`const value=${JSON.stringify(key)};`);
      const result=f.run({RATE_LIMIT_SECRET:key});
      expect(result.status).not.toBe(0); expect(result.stderr).toContain('Value redacted');
      expect(result.stderr).not.toContain(key);
    }finally{rmSync(f.root,{recursive:true,force:true});}
  });
});
