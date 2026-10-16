// Debounced input + explicit Enter. Request-version checks in each feature keep
// stale responses from repainting a newer search. No personal data in the URL.
export function initializeSearch(
  name: string,
  load: () => Promise<unknown>,
  failure: (message: string) => void,
) {
  const form = document.getElementById(name + '-search-form') as HTMLFormElement;
  const input = document.getElementById(name + '-search') as HTMLInputElement;
  if (!form || !input) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  const run = () => {
    clearTimeout(timer);
    const current = ++generation;
    void load().catch((error) => {
      if (current === generation)
        failure(error instanceof Error ? error.message : 'Search could not be completed.');
    });
  };
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (form.reportValidity()) run();
  });
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(run, 250);
  });
  window.addEventListener('vss-session-closed', () => {
    clearTimeout(timer);
    ++generation;
    input.value = '';
  });
}
