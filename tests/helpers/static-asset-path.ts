// Test fixture only: URL paths must remain inside the build on Windows/POSIX.
import * as nativePath from 'node:path';
type PathApi = Pick<typeof nativePath, 'resolve' | 'relative' | 'isAbsolute' | 'sep'>;
export function staticAssetPath(output: string, pathname: string, paths: PathApi = nativePath) {
  if (!pathname.startsWith('/') || pathname.includes('\\') || pathname.includes('\0'))
    throw new Error('Invalid static asset path');
  const file = paths.resolve(output, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
  const relative = paths.relative(output, file);
  if (!relative || relative === '..' || relative.startsWith('..' + paths.sep) || paths.isAbsolute(relative))
    throw new Error('Static asset path is outside the build directory');
  return file;
}
