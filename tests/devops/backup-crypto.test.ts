import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
it('restores encrypted records but rejects tampered ciphertext without writing plaintext',()=>{
  const root=mkdtempSync(join(tmpdir(),'vss-crypto-'));
  const run=(name:string,input:string,output:string)=>spawnSync(process.execPath,[fileURLToPath(new URL('../../devops/scripts/'+name,import.meta.url)),input,output],{encoding:'utf8',env:{...process.env,BACKUP_ENCRYPTION_KEY:'synthetic-long-passphrase-for-encryption-test'}});
  try{
    const source=join(root,'source.sql'), encrypted=join(root,'backup.enc'), restored=join(root,'restored.sql');
    writeFileSync(source,'Synthetic private contact and message');
    expect(run('encrypt-backup.mjs',source,encrypted).status).toBe(0);
    expect(readFileSync(encrypted).includes(Buffer.from('Synthetic private'))).toBe(false);
    expect(run('decrypt-backup.mjs',encrypted,restored).status).toBe(0);
    expect(readFileSync(restored,'utf8')).toBe(readFileSync(source,'utf8'));
    const corrupted=readFileSync(encrypted);corrupted[corrupted.length-1]^=1;writeFileSync(encrypted,corrupted);
    const rejected=join(root,'rejected.sql');
    expect(run('decrypt-backup.mjs',encrypted,rejected).status).not.toBe(0);
    expect(existsSync(rejected)).toBe(false);
  }finally{rmSync(root,{recursive:true,force:true});}
});
