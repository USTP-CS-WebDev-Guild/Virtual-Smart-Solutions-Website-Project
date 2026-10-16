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

export async function loadClients(more = false) {
  const session = workspace.sessionVersion;
  const version = ++requestVersion;
  const target = more ? pages + 1 : pages;
  const records = new Map<string, Client>();
  let cursor: string | null = null;
  let readPages = 0;
  for (let i = 0; i < target; i++) {
    const result: { clients: Client[]; nextCursor: string | null } = await api(
      '/api/admin/clients' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''),
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
  list.replaceChildren();
  if (!records.size)
    list.append(make('p', 'loading-state', 'Converted inquiries appear here as clients.'));
  for (const item of records.values()) {
    const card = make('article', 'client-card');
    const details = make('div');
    details.append(
      make('h3', '', item.contactName),
      make('p', '', item.company || 'Independent business'),
    );
    const email = make('a', '', item.email);
    email.href = 'mailto:' + item.email;
    details.append(email, make('p', 'detail-date', 'Client since ' + formatDate(item.createdAt)));
    const actions = make('div', 'client-actions');
    const label = make('label', 'detail-status-label', 'CLIENT STATUS');
    const select = make('select') as HTMLSelectElement;
    select.dataset.clientStatus = item.id;
    select.dataset.serverStatus = item.status;
    for (const status of ['active', 'paused', 'closed'])
      select.add(new Option(status[0]!.toUpperCase() + status.slice(1), status));
    select.value = drafts.get(item.id) || item.status;
    const archived = item.email.endsWith('@deleted.invalid');
    select.disabled = archived;
    label.append(select);
    const save = make('button', 'button button-dark', 'Save status');
    save.type = 'button';
    save.disabled = archived;
    save.addEventListener('click', async () => {
      save.disabled = true;
      try {
        await api('/api/admin/clients/' + item.id + '/status', {
          method: 'PATCH',
          body: JSON.stringify({ status: select.value }),
        });
        setAlert('Client status saved.', 'success');
        await loadClients();
      } catch (error) {
        setAlert(error instanceof Error ? error.message : 'Could not update client.', 'error');
      } finally {
        save.disabled = archived;
      }
    });
    const source = make('button', 'cms-secondary-button', 'View original inquiry');
    source.type = 'button';
    source.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('vss-open-inquiry', { detail: item.sourceInquiryId }));
    });
    actions.append(label, save, source);
    card.append(details, actions);
    list.append(card);
  }
  byId<HTMLButtonElement>('clients-more').hidden = !cursor;
}
