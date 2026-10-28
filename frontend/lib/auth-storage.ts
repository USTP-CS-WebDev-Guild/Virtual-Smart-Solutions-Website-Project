// Staff refresh/access tokens stay in this tab, never persistent localStorage.
// This is still JS-readable storage: CSP, safe DOM rendering and MFA also matter.
export function tabAuthStorage() {
  const memory = new Map<string, string>();
  return {
    getItem(key: string) {
      try { return sessionStorage.getItem(key) ?? memory.get(key) ?? null; }
      catch { return memory.get(key) ?? null; }
    },
    setItem(key: string, value: string) {
      memory.set(key, value);
      try { sessionStorage.setItem(key, value); } catch { /* Memory-only fallback. */ }
    },
    removeItem(key: string) {
      memory.delete(key);
      try { sessionStorage.removeItem(key); } catch { /* Memory-only fallback. */ }
    },
  };
}
