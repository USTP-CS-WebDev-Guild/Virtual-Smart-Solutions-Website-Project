// Editor sections change presentation only. The server checks the owner role
// and validates the entire content revision before publication.
export function showContentSection(section: string) {
  const target = document.getElementById('editor-' + section);
  if (!target?.hasAttribute('data-editor-section')) return;
  document.querySelectorAll<HTMLElement>('[data-editor-section]').forEach((panel) => {
    panel.hidden = panel !== target;
  });
  document.querySelectorAll<HTMLButtonElement>('[data-editor-tab]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.editorTab === section));
  });
}
export function initializeContentNavigation() {
  document.querySelectorAll<HTMLButtonElement>('[data-editor-tab]').forEach((button) => {
    button.addEventListener('click', () =>
      showContentSection(button.dataset.editorTab || 'settings'),
    );
  });
}
