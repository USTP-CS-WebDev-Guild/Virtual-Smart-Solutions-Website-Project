import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
const excluded = new Set(['.git','node_modules','dist','.astro','.local','.classroom-backups','.netlify','.e2e-dist','test-results','playwright-report']);
function walk(root='.') {
  return readdirSync(root,{withFileTypes:true}).flatMap(entry=>{
    const file=join(root,entry.name);
    if(entry.isDirectory()) return excluded.has(entry.name)?[]:walk(file);
    if(!entry.isFile() || (entry.name.startsWith('.env') && entry.name!=='.env.example')) return [];
    return [file];
  });
}
let files;
try { files=execFileSync('git',['ls-files','-z'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).split('\0').filter(Boolean); }
catch { files=walk(); }
const failures=[];
for(const file of files) {
  if(!existsSync(file)) continue;
  if((basename(file).startsWith('.env') && basename(file)!=='.env.example') ||
      /(?:^|\/)(?:\.local|node_modules|backups)\//.test(file)) { failures.push(file+': private/generated file is tracked'); continue; }
  if(!/\.(?:[cm]?[jt]sx?|astro|json|ya?ml|md|sql|toml|txt|example)$/.test(file)) continue;
  const lines=readFileSync(file,'utf8').split('\n');
  lines.forEach((line,index)=>{
    // Explicitly named synthetic fixtures are test credentials, not real keys.
    const candidates=line.match(/sb_secret_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{25,}|gh[pousr]_[A-Za-z0-9]{30,}|\bre_[A-Za-z0-9_-]{24,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g)||[];
    for(const jwt of line.match(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g)||[]) {
      try { if(JSON.parse(Buffer.from(jwt.split('.')[1],'base64url').toString()).role==='service_role') candidates.push(jwt); }
      catch { /* Not a parseable credential. */ }
    }
    if(candidates.some(value=>!value.includes('SYNTHETIC')&&!value.includes('NOT_A_REAL_KEY')))
      failures.push(`${file}:${index+1}: possible private credential (value redacted)`);
  });
}
if(failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`Source credential check passed (${files.length} files). This supplements provider secret scanning and code review.`);
