export const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export function setAlert(message: string, tone: 'error' | 'success' | 'info' = 'info') {
  const alert = byId<HTMLElement>('admin-alert');
  alert.textContent = message;
  alert.className = message ? 'admin-alert is-visible is-' + tone : 'admin-alert';
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
  ]) {
    byId<HTMLElement>(id).replaceChildren();
  }
  byId<HTMLElement>('admin-login').hidden = false;
  for (const id of ['metric-new', 'metric-progress', 'metric-waiting', 'metric-email']) {
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
}
import { workspace } from './state';

export function setWorkspaceRole(role: 'owner' | 'staff') {
  workspace.actorRole = role;
  byId<HTMLElement>('content-nav').classList.toggle('is-hidden', role !== 'owner');
  document
    .querySelector<HTMLElement>('[data-view="privacy"]')
    ?.classList.toggle('is-hidden', role !== 'owner');
  const testJobs = document.querySelector<HTMLElement>('.test-jobs-panel');
  if (testJobs) testJobs.hidden = role !== 'owner';
}
