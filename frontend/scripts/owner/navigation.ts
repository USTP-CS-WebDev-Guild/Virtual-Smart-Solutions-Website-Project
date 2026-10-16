import { workspace, type WorkspaceView } from './state';

const headings: Record<WorkspaceView, string> = {
  overview: 'Overview',
  inquiries: 'Inquiries',
  clients: 'Clients',
  privacy: 'Privacy requests',
  content: 'Website editor',
  settings: 'Settings & help',
};
export function allowedView(value: string, role = workspace.actorRole): WorkspaceView {
  const candidate = value.replace(/^#/, '').split('/')[0] as WorkspaceView;
  if (!Object.hasOwn(headings, candidate)) return 'overview';
  if (role !== 'owner' && ['privacy', 'content', 'settings'].includes(candidate)) return 'overview';
  return candidate;
}
export function applyWorkspaceView(view: WorkspaceView, push = true) {
  view = allowedView(view);
  const changed = workspace.view !== view;
  workspace.view = view;
  document.querySelectorAll<HTMLElement>('.admin-view').forEach((panel) => {
    panel.hidden = panel.id !== view + '-view';
    panel.classList.toggle('is-hidden', panel.hidden);
  });
  document.querySelectorAll<HTMLButtonElement>('.admin-nav-item').forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  const title = document.getElementById('page-heading');
  if (title) title.textContent = headings[view];
  document.title = headings[view] + ' — VSS Workspace';
  if (push && location.hash !== '#' + view) history.pushState(null, '', '#' + view);
  closeWorkspaceMenu();
  if (changed) {
    window.scrollTo?.({ top: 0, behavior: 'instant' });
    title?.focus({ preventScroll: true });
  }
  return view;
}
export function closeWorkspaceMenu(restoreFocus = false) {
  const sidebar = document.getElementById('workspace-navigation');
  if (sidebar) sidebar.dataset.open = 'false';
  document.getElementById('workspace-menu-toggle')?.setAttribute('aria-expanded', 'false');
  const backdrop = document.getElementById('workspace-nav-backdrop');
  if (backdrop) backdrop.hidden = true;
  delete document.body.dataset.navigationOpen;
  const main = document.getElementById('admin-main');
  if (main) main.inert = false;
  if (restoreFocus) document.getElementById('workspace-menu-toggle')?.focus();
}
export function initializeWorkspaceNavigation(
  navigate: (view: WorkspaceView, refresh?: boolean, push?: boolean) => void,
) {
  document.querySelectorAll<HTMLButtonElement>('[data-view],[data-go-view]').forEach((button) => {
    button.addEventListener('click', () =>
      navigate(allowedView(button.dataset.view || button.dataset.goView || 'overview')),
    );
  });
  const restoreView = () => {
    if (
      /^#(overview|inquiries|clients|privacy|content|settings)$/.test(location.hash) ||
      !location.hash
    ) {
      const view = allowedView(location.hash);
      if (view !== workspace.view) navigate(view, true, false);
    }
  };
  window.addEventListener('popstate', restoreView);
  window.addEventListener('hashchange', restoreView);
  document.getElementById('workspace-menu-toggle')?.addEventListener('click', () => {
    const sidebar = document.getElementById('workspace-navigation');
    if (!sidebar) return;
    if (sidebar.dataset.open === 'true') return closeWorkspaceMenu(true);
    sidebar.dataset.open = 'true';
    document.body.dataset.navigationOpen = 'true';
    document.getElementById('workspace-menu-toggle')!.setAttribute('aria-expanded', 'true');
    document.getElementById('workspace-nav-backdrop')!.hidden = false;
    document.getElementById('admin-main')!.inert = true;
    document.getElementById('workspace-menu-close')?.focus();
  });
  for (const id of ['workspace-menu-close', 'workspace-nav-backdrop'])
    document.getElementById(id)?.addEventListener('click', () => closeWorkspaceMenu(true));
  document.addEventListener('keydown', (event) => {
    if (document.body.dataset.navigationOpen !== 'true') return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeWorkspaceMenu(true);
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      document.querySelectorAll<HTMLElement>(
        '#workspace-navigation a,#workspace-navigation button',
      ),
    ).filter((item) => !item.hidden && !item.closest('[hidden]'));
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
  window.matchMedia('(min-width: 901px)').addEventListener('change', (event) => {
    if (event.matches) closeWorkspaceMenu();
  });
  window.addEventListener('vss-session-closed', () => closeWorkspaceMenu());
}
