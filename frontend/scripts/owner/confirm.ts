// One accessible confirmation dialog, shared by conversion and privacy actions.
// Native dialog handles focus containment and Escape. No private data is stored.
export async function confirmAction(
  title: string,
  description: string,
  label = 'Continue',
  destructive = false,
): Promise<boolean> {
  const dialog = document.getElementById('workspace-confirm') as HTMLDialogElement | null;
  if (!dialog || typeof dialog.showModal !== 'function')
    return window.confirm(title + '\n\n' + description);
  if (dialog.open) return false;
  dialog.querySelector<HTMLElement>('#confirm-title')!.textContent = title;
  dialog.querySelector<HTMLElement>('#confirm-description')!.textContent = description;
  dialog.querySelector<HTMLButtonElement>('#confirm-accept')!.textContent = label;
  dialog.classList.toggle('is-destructive', destructive);
  dialog.returnValue = 'cancel';
  const trigger = document.activeElement as HTMLElement | null;
  return new Promise((resolve) => {
    const sessionClosed = () => dialog.close('cancel');
    const closed = () => {
      window.removeEventListener('vss-session-closed', sessionClosed);
      const accepted = dialog.returnValue === 'confirm';
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      resolve(accepted);
    };
    dialog.addEventListener('close', closed, { once: true });
    window.addEventListener('vss-session-closed', sessionClosed, { once: true });
    dialog.showModal();
  });
}
