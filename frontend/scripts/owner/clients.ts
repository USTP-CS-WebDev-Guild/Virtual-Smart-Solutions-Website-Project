import { api } from './api';
import { byId, make, formatDate, setAlert } from './ui';
import { workspace } from './state';

type Client = {
  id: string;
  sourceInquiryId: string;
  contactName: string;
  email: string;
  company: string | null;
  status: string;
  createdAt: number;
};
let pages = 1;
let requestVersion = 0;
let lastCriteria = '';
const savedDrafts = new Map<string, string>();
window.addEventListener('vss-session-closed', () => {
  ++requestVersion;
  pages = 1;
  lastCriteria = '';
  savedDrafts.clear();
});

export async function loadClients(more = false) {
  const session = workspace.sessionVersion;
  const version = ++requestVersion;
  const search =
    (document.getElementById('client-search') as HTMLInputElement | null)?.value.trim() || '';
  const status =
    (document.getElementById('client-status-filter') as HTMLSelectElement | null)?.value || '';
  const criteria = search + '\n' + status;
  if (criteria !== lastCriteria) {
    pages = 1;
    lastCriteria = criteria;
  }
  const target = more ? pages + 1 : pages;
  const records = new Map<string, Client>();
  let cursor: string | null = null;
  let readPages = 0;
  for (let i = 0; i < target; i++) {
    const query = new URLSearchParams();
    if (search) query.set('q', search);
    if (status) query.set('status', status);
    if (cursor) query.set('cursor', cursor);
    const result: { clients: Client[]; nextCursor: string | null } = await api(
      '/api/admin/clients?' + query,
    );
    result.clients.forEach((row) => records.set(row.id, row));
    cursor = result.nextCursor;
    readPages++;
    if (!cursor) break;
  }
  if (
    session !== workspace.sessionVersion ||
    version !== requestVersion ||
    byId<HTMLElement>('admin-app').hidden
  )
    return;
  pages = readPages;
  const list = byId<HTMLElement>('client-list');
  const drafts = new Map(
    Array.from(list.querySelectorAll<HTMLSelectElement>('[data-client-status]'))
      .filter((select) => select.value !== select.dataset.serverStatus)
      .map((select) => [select.dataset.clientStatus!, select.value]),
  );
  for (const [id, value] of drafts) savedDrafts.set(id, value);
  const focused =
    document.activeElement instanceof HTMLSelectElement
      ? document.activeElement.dataset.clientStatus
      : null;
  list.replaceChildren();
  if (!records.size) {
    const empty = make('div', 'workspace-panel loading-state');
    empty.append(
      make('span', 'empty-state-icon', '↗'),
      make(
        'h3',
        '',
        search || status ? 'No matching clients.' : 'Your next client starts with a conversation.',
      ),
      make(
        'p',
        '',
        search || status
          ? 'Try another search or choose All clients.'
          : 'Open an inquiry and choose Convert to client after you’ve agreed to work together.',
      ),
    );
    list.append(empty);
  }
  for (const item of records.values()) {
    const card = make('article', 'client-card');
    const identity = make('div', 'client-identity');
    const avatar = make(
      'span',
      'contact-avatar',
      item.contactName
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word[0])
        .join('')
        .toUpperCase(),
    );
    avatar.setAttribute('aria-hidden', 'true');
    const details = make('div');
    identity.append(avatar, details);
    details.append(
      make('h3', '', item.contactName),
      make('p', '', item.company || 'Independent business'),
    );
    const email = make('a', '', item.email);
    email.href = 'mailto:' + item.email;
    details.append(
      make(
        'span',
        'status-badge status-' + item.status,
        item.status[0]!.toUpperCase() + item.status.slice(1),
      ),
      make('br'),
      email,
      make('p', 'detail-date', 'Client since ' + formatDate(item.createdAt)),
    );
    const actions = make('div', 'client-actions');
    const label = make('label', 'detail-status-label', 'CLIENT STATUS');
    const select = make('select') as HTMLSelectElement;
    select.dataset.clientStatus = item.id;
    select.dataset.serverStatus = item.status;
    for (const status of ['active', 'paused', 'closed']) {
      const option = make('option', '', status[0]!.toUpperCase() + status.slice(1));
      option.value = status;
      select.append(option);
    }
    select.value = savedDrafts.get(item.id) || item.status;
    const archived = item.email.endsWith('@deleted.invalid');
    select.disabled = archived;
    if (archived) {
      select.value = item.status;
      savedDrafts.delete(item.id);
    }
    label.append(select);
    const save = make('button', 'button button-dark', 'Save status');
    save.type = 'button';
    save.disabled = archived || select.value === item.status;
    select.addEventListener('change', () => {
      save.disabled = archived || select.value === select.dataset.serverStatus;
      if (select.value === select.dataset.serverStatus) savedDrafts.delete(item.id);
      else savedDrafts.set(item.id, select.value);
    });
    save.addEventListener('click', async () => {
      save.disabled = true;
      try {
        await api('/api/admin/clients/' + item.id + '/status', {
          method: 'PATCH',
          body: JSON.stringify({ status: select.value }),
        });
        if (session !== workspace.sessionVersion) return;
        select.dataset.serverStatus = select.value;
        savedDrafts.delete(item.id);
        setAlert('Client status saved.', 'success');
        await loadClients();
      } catch (error) {
        setAlert(error instanceof Error ? error.message : 'Could not update client.', 'error');
      } finally {
        save.disabled = archived || select.value === select.dataset.serverStatus;
      }
    });
    const source = make('button', 'cms-secondary-button', 'View original inquiry');
    source.type = 'button';
    source.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('vss-open-inquiry', { detail: item.sourceInquiryId }));
    });
    actions.append(label, save, source);
    card.append(identity, actions);
    list.append(card);
  }
  const count = document.getElementById('client-result-count');
  if (count)
    count.textContent =
      records.size + (cursor ? '+' : '') + ' client' + (records.size === 1 ? '' : 's') + ' shown';
  if (focused)
    Array.from(list.querySelectorAll<HTMLSelectElement>('[data-client-status]'))
      .find((node) => node.dataset.clientStatus === focused)
      ?.focus({ preventScroll: true });
  byId<HTMLButtonElement>('clients-more').hidden = !cursor;
}
