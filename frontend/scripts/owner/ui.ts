export const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export function setAlert(message: string, tone: 'error' | 'success' | 'info' = 'info') {
  const alert = byId<HTMLElement>('admin-alert');
  alert.replaceChildren();
  alert.className = message ? 'admin-alert is-visible is-' + tone : 'admin-alert';
  alert.setAttribute('aria-live', tone === 'error' ? 'assertive' : 'polite');
  if (!message) return;
  const text = make('span', 'admin-alert-message', message);
  const close = make('button', 'alert-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Dismiss notification');
  close.addEventListener('click', () => setAlert(''));
  alert.append(text, close);
}

export function formatDate(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function make<K extends keyof HTMLElementTagNameMap>(
  name: K,
  className?: string,
  text?: string,
) {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function showWorkspaceLogin(message = '') {
  ++workspace.sessionVersion;
  window.dispatchEvent(new Event('vss-session-closed'));
  byId<HTMLElement>('admin-app').hidden = true;
  setWorkspaceRole('staff');
  // Remove private records from the page whenever the session is no longer valid.
  for (const id of [
    'inquiry-list',
    'inquiry-detail',
    'privacy-queue',
    'cms-settings-fields',
    'cms-services',
    'cms-faqs',
    'content-history',
    'client-list',
    'overview-recent',
    'cms-plans',
    'cms-portfolio',
    'cms-team',
  ]) {
    byId<HTMLElement>(id).replaceChildren();
  }
  byId<HTMLElement>('admin-login').hidden = false;
  setAlert('');
  delete document.body.dataset.inquiryOpen;
  document.getElementById('workspace-skip-link')?.setAttribute('href', '#admin-login');
  for (const id of ['workspace-account-email', 'settings-account-email']) {
    const el = document.getElementById(id);
    if (el) el.textContent = 'Signed-in account';
  }
  const password = byId<HTMLInputElement>('staff-password');
  password.type = 'password';
  const toggle = document.getElementById('toggle-password');
  if (toggle) {
    toggle.textContent = 'Show';
    toggle.setAttribute('aria-pressed', 'false');
  }
  for (const id of [
    'metric-new',
    'metric-progress',
    'metric-waiting',
    'metric-email',
    'metric-converted',
  ]) {
    byId<HTMLElement>(id).textContent = '—';
  }
  byId<HTMLElement>('new-count').textContent = '0';
  const connection = document.querySelector<HTMLElement>('.system-status');
  if (connection) {
    connection.className = 'system-status';
    connection.replaceChildren(make('i'), document.createTextNode(' Checking connection…'));
  }
  const status = byId<HTMLElement>('staff-login-status');
  status.textContent = message;
  status.classList.toggle('is-success', false);
  byId<HTMLInputElement>('staff-password').value = '';
  document.getElementById('submission-check-results')?.replaceChildren();
  const updatedAt = document.getElementById('inbox-updated-at');
  if (updatedAt) updatedAt.textContent = 'Checking for inquiries…';
  for (const id of ['confirm-title', 'confirm-description'])
    document.getElementById(id)?.replaceChildren();
}
import { workspace } from './state';

export function setWorkspaceRole(role: 'owner' | 'staff') {
  const revoked =
    workspace.actorRole === 'owner' && role === 'staff' && !byId<HTMLElement>('admin-app').hidden;
  workspace.actorRole = role;
  if (revoked) {
    showWorkspaceLogin('Your workspace access changed. Sign in again to continue.');
    return;
  }
  document.querySelectorAll<HTMLElement>('[data-owner-only]').forEach((element) => {
    element.hidden = role !== 'owner';
    element.classList.toggle('is-hidden', role !== 'owner');
  });
  const accountRole = document.getElementById('workspace-account-role');
  if (accountRole) accountRole.textContent = role === 'owner' ? 'Workspace owner' : 'Team member';
  const testJobs = document.querySelector<HTMLElement>('.test-jobs-panel');
  if (testJobs) testJobs.hidden = role !== 'owner';
}
