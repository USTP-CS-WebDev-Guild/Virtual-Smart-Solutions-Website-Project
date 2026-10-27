// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { tabAuthStorage } from '../../frontend/lib/auth-storage';
afterEach(()=>{ vi.unstubAllGlobals(); sessionStorage.clear(); localStorage.clear(); });
it('keeps credentials in the current tab instead of persistent localStorage',()=>{
  const storage=tabAuthStorage(); storage.setItem('session','synthetic-token');
  expect(sessionStorage.getItem('session')).toBe('synthetic-token');
  expect(localStorage.getItem('session')).toBeNull();
  storage.removeItem('session'); expect(storage.getItem('session')).toBeNull();
});
it('supports private browser storage failures without persisting credentials elsewhere',()=>{
  vi.stubGlobal('sessionStorage',{getItem(){throw new Error();},setItem(){throw new Error();},removeItem(){throw new Error();}});
  const storage=tabAuthStorage(); storage.setItem('session','memory-token');
  expect(storage.getItem('session')).toBe('memory-token');
  storage.removeItem('session'); expect(storage.getItem('session')).toBeNull();
  expect(localStorage.length).toBe(0);
});
