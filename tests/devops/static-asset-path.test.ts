import { posix, win32 } from 'node:path';
import { describe, expect, it } from 'vitest';
import { staticAssetPath } from '../helpers/static-asset-path';
for (const [name, paths, root] of [
  ['Windows',win32,'C:\\Projects\\VSS Website\\.e2e-dist'],
  ['POSIX',posix,'/workspace/VSS Website/.e2e-dist'],
] as const) describe(name+' browser assets',()=>{
  it('resolves documents and nested scripts without rejecting valid paths',()=>{
    expect(staticAssetPath(root,'/admin/',paths)).toBe(paths.resolve(root,'admin/index.html'));
    expect(staticAssetPath(root,'/_astro/site.js',paths)).toBe(paths.resolve(root,'_astro/site.js'));
  });
  it('rejects parent and sibling-prefix escapes',()=>{
    for (const url of ['/../private.json','/../.e2e-dist-private/key','/..'])
      expect(()=>staticAssetPath(root,url,paths)).toThrow();
  });
  it('rejects Windows separator injection and null bytes',()=>{
    for (const url of ['/..\\private.json','/admin\0/']) expect(()=>staticAssetPath(root,url,paths)).toThrow();
  });
});
