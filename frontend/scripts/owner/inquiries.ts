import type { Inquiry } from './types';
import { api } from './api';
import { byId, formatDate, make, setAlert, setWorkspaceRole } from './ui';
import { workspace, testEnvironment } from './state';

const statusLabels: Record<string, string> = {
  new: 'New',
  in_progress: 'In progress',
  waiting: 'Waiting',
  converted: 'Converted',
  closed: 'Closed',
};
let currentInquiries: Inquiry[] = [];
let selectedId = '';
let pages = 1;
let lastFilter = '';
function makeInquiryRow(item: Inquiry) {
  const button = make('button', 'inquiry-row');
  button.type = 'button';
  button.setAttribute('aria-pressed', String(item.id === selectedId));
  button.classList.toggle('is-selected', item.id === selectedId);
  const top = make('span', 'inquiry-row-top');
  top.append(make('strong', '', item.name));
  const badge = make(
    'span',
    'status-badge status-' + item.status,
    statusLabels[item.status] || item.status,
  );
  top.append(badge);
  const subject = make('span', 'inquiry-row-subject', item.service);
  const bottom = make('span', 'inquiry-row-bottom');
  bottom.append(make('span', '', item.company || item.email));
  bottom.append(make('time', '', formatDate(item.createdAt)));
  button.append(top, subject, bottom);
  if (item.possibleDuplicate)
    button.append(make('span', 'duplicate-flag', 'Possible repeat inquiry'));
  button.addEventListener('click', () => {
    showDetail(item.id).catch((error) => setAlert(error.message, 'error'));
  });
  return button;
}

function renderInquiries() {
  const list = byId<HTMLElement>('inquiry-list');
  list.replaceChildren();
  if (!currentInquiries.length) {
    list.append(make('div', 'loading-state', 'No inquiries in this view yet.'));
    return;
  }
  for (const item of currentInquiries) list.append(makeInquiryRow(item));
}

function appendDetailField(parent: HTMLElement, label: string, value: string) {
  const wrapper = make('div', 'detail-field');
  wrapper.append(make('span', '', label));
  const content = make('p', '', value || 'Not provided');
  wrapper.append(content);
  parent.append(wrapper);
}

async function showDetail(id: string) {
  const session = workspace.sessionVersion;
  selectedId = id;
  if (!currentInquiries.some((item) => item.id === id)) {
    const response = await api<{ inquiry: Inquiry }>(
      '/api/admin/inquiries/' + encodeURIComponent(id),
    );
    if (!sessionCurrent(session)) return;
    currentInquiries = [response.inquiry, ...currentInquiries];
  }
  renderInquiries();
  const item = currentInquiries.find((inquiry) => inquiry.id === id);
  if (!item) return;
  const panel = byId<HTMLElement>('inquiry-detail');
  panel.replaceChildren();

  const head = make('div', 'detail-head');
  const kicker = make('p', 'eyebrow', 'INQUIRY / ' + id.slice(0, 8).toUpperCase());
  const title = make('h2', '', item.name);
  const liveStatus = make(
    'p',
    'detail-live-status',
    'Current status: ' + (statusLabels[item.status] || item.status),
  );
  liveStatus.dataset.detailStatus = '';
  const date = make('p', 'detail-date', 'Received ' + formatDate(item.createdAt));
  const duplicate = item.possibleDuplicate
    ? make('p', 'duplicate-banner', 'Possible repeat: a recent inquiry used this email address.')
    : null;
  head.append(kicker, title, date, liveStatus);
  if (duplicate) head.append(duplicate);

  const fields = make('div', 'detail-fields');
  const email = make('a', '', item.email) as HTMLAnchorElement;
  email.href = 'mailto:' + item.email;
  const emailField = make('div', 'detail-field');
  emailField.append(make('span', '', 'EMAIL'), email);
  fields.append(emailField);
  appendDetailField(fields, 'BUSINESS', item.company || '');
  appendDetailField(fields, 'PHONE', item.phone || '');
  appendDetailField(fields, 'SERVICE', item.service);
  if (item.requestedPlan)
    appendDetailField(
      fields,
      'REQUESTED PACKAGE',
      `${item.requestedPlan.name} · ${item.requestedPlan.price} ${item.requestedPlan.period}`,
    );
  const message = make('div', 'detail-message');
  message.append(make('span', 'eyebrow', 'MESSAGE'), make('p', '', item.message));

  const notification = make('div', 'notification-state');
  const deliveryStatus =
    item.notification?.delivery_status === 'test_captured'
      ? 'Captured in test mode — no email was sent'
      : item.notification?.delivery_status || item.notification?.status;
  const stateText = item.notification
    ? deliveryStatus + ' · ' + item.notification.attempts + ' attempt(s)'
    : 'No notification record';
  notification.append(make('span', 'eyebrow', 'EMAIL NOTIFICATION'), make('p', '', stateText));
  if (item.notification?.last_error) {
    notification.append(make('small', 'error-code', item.notification.last_error));
  }
  if (item.notification?.status === 'dead' && workspace.actorRole === 'owner') {
    const retry = make(
      'button',
      'cms-secondary-button',
      'Retry failed notice',
    ) as HTMLButtonElement;
    retry.type = 'button';
    retry.addEventListener('click', async () => {
      retry.disabled = true;
      try {
        await api('/api/admin/outbox/retry', {
          method: 'POST',
          body: JSON.stringify({ id: item.notification?.id }),
        });
        setAlert('Notice queued for another attempt.', 'success');
        await loadInquiries();
      } catch (error) {
        setAlert(error instanceof Error ? error.message : 'Could not retry the notice.', 'error');
      } finally {
        retry.disabled = false;
      }
    });
    notification.append(retry);
  }

  const actions = make('div', 'detail-actions');
  const statusLabel = make('label', 'detail-status-label', 'NEXT STEP');
  const statusSelect = make('select', 'detail-status-select') as HTMLSelectElement;
  statusSelect.disabled = item.status === 'converted' || Boolean(item.anonymizedAt);
  statusSelect.dataset.serverStatus = item.status;
  for (const value of ['new', 'in_progress', 'waiting', 'closed', 'converted']) {
    const option = make('option', '', statusLabels[value]) as HTMLOptionElement;
    option.value = value;
    option.selected = item.status === value;
    option.disabled = value === 'converted';
    statusSelect.append(option);
  }
  statusLabel.append(statusSelect);
  const save = make('button', 'button button-dark', 'Save status') as HTMLButtonElement;
  save.type = 'button';
  save.disabled = item.status === 'converted' || Boolean(item.anonymizedAt);
  save.dataset.saveStatus = '';
  save.addEventListener('click', async () => {
    save.disabled = true;
    try {
      await api('/api/admin/inquiries/' + encodeURIComponent(item.id) + '/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: statusSelect.value }),
      });
      setAlert('Inquiry status updated.', 'success');
      await loadInquiries();
      await showDetail(item.id);
    } catch (error) {
      setAlert(error instanceof Error ? error.message : 'Could not update status.', 'error');
    } finally {
      save.disabled = false;
    }
  });
  const convert = make('button', 'button button-convert', 'Convert to client') as HTMLButtonElement;
  convert.type = 'button';
  convert.disabled = item.status === 'converted' || Boolean(item.anonymizedAt);
  convert.dataset.convert = '';
  convert.addEventListener('click', async () => {
    convert.disabled = true;
    try {
      await api('/api/admin/inquiries/' + encodeURIComponent(item.id) + '/convert', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setAlert('Inquiry converted. The action is safe to repeat.', 'success');
      await loadInquiries();
      await showDetail(item.id);
    } catch (error) {
      setAlert(error instanceof Error ? error.message : 'Could not convert inquiry.', 'error');
      convert.disabled = false;
    }
  });
  actions.append(statusLabel, save, convert);

  const eventBox = make('div', 'event-box');
  eventBox.append(make('p', 'eyebrow', 'HISTORY'));
  eventBox.append(make('p', 'event-placeholder', 'Loading activity…'));
  const notes = make('section', 'inquiry-notes');
  notes.append(make('p', 'eyebrow', 'FOLLOW-UP NOTES'));
  const noteList = make('div', 'note-list');
  noteList.id = 'inquiry-note-list';
  const form = make('form', 'inquiry-note-form');
  const label = make('label', '', 'Add a follow-up note');
  const input = make('textarea') as HTMLTextAreaElement;
  input.name = 'note';
  input.rows = 3;
  input.required = true;
  input.minLength = 2;
  input.maxLength = 2000;
  input.disabled = Boolean(item.anonymizedAt);
  input.placeholder =
    'Record the next step or outcome. Do not include passwords or payment details.';
  label.append(input);
  const submit = make('button', 'button button-dark', 'Save note');
  submit.type = 'submit';
  submit.disabled = Boolean(item.anonymizedAt);
  let noteKey = crypto.randomUUID();
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    submit.disabled = true;
    try {
      await api('/api/admin/inquiries/' + item.id + '/notes', {
        method: 'POST',
        body: JSON.stringify({ idempotencyKey: noteKey, body: input.value }),
      });
      input.value = '';
      noteKey = crypto.randomUUID();
      await refreshNotes(item.id);
      setAlert('Follow-up note saved.', 'success');
    } catch (error) {
      setAlert(error instanceof Error ? error.message : 'Could not save note.', 'error');
    } finally {
      submit.disabled = Boolean(item.anonymizedAt);
    }
  });
  form.append(label, submit);
  notes.append(noteList, form);
  panel.append(head, fields, message, notification, actions, notes, eventBox);
  void refreshNotes(id).catch(() => {});
  await refreshHistory(id, eventBox);
}

async function refreshHistory(id: string, eventBox: HTMLElement) {
  const session = workspace.sessionVersion;
  try {
    const result = await api<{
      events: Array<{
        eventType: string;
        actorType: string;
        actorId: string | null;
        createdAt: number;
      }>;
    }>('/api/admin/inquiries/' + encodeURIComponent(id) + '/events');
    if (!sessionCurrent(session) || selectedId !== id) return;
    eventBox.replaceChildren(make('p', 'eyebrow', 'HISTORY'));
    for (const event of result.events) {
      const entry = make('div', 'event-entry');
      entry.append(make('span', 'event-dot'));
      const description = event.eventType.replaceAll('_', ' ');
      const copy = make('div');
      copy.append(make('strong', '', description));
      copy.append(
        make(
          'small',
          '',
          formatDate(event.createdAt) + (event.actorId ? ' · ' + event.actorId : ''),
        ),
      );
      entry.append(copy);
      eventBox.append(entry);
    }
  } catch {
    eventBox.replaceChildren(
      make('p', 'eyebrow', 'HISTORY'),
      make('p', 'event-placeholder', 'Activity could not be loaded.'),
    );
  }
}

async function refreshNotes(id: string) {
  const session = workspace.sessionVersion;
  const result = await api<{
    notes: Array<{ body: string; createdBy: string; createdAt: number }>;
  }>('/api/admin/inquiries/' + id + '/notes');
  if (!sessionCurrent(session) || selectedId !== id) return;
  const list = document.getElementById('inquiry-note-list');
  if (!list) return;
  list.replaceChildren();
  if (!result.notes.length) list.append(make('p', 'detail-date', 'No follow-up notes yet.'));
  for (const note of result.notes) {
    const row = make('article', 'inquiry-note');
    row.append(
      make('p', '', note.body),
      make('small', '', formatDate(note.createdAt) + ' · ' + note.createdBy),
    );
    list.append(row);
  }
}

export async function openInquiry(id: string) {
  await showDetail(id);
}

function sessionCurrent(version: number) {
  return version === workspace.sessionVersion && !byId<HTMLElement>('admin-app').hidden;
}

async function loadSummary(version: number) {
  const result = await api<{
    actorRole: 'owner' | 'staff';
    inquiries: Record<string, number>;
    notifications: { pending: number; dead: number };
  }>('/api/admin/summary');
  if (!sessionCurrent(version)) return false;
  setWorkspaceRole(result.actorRole);
  byId<HTMLElement>('metric-new').textContent = String(result.inquiries.new || 0);
  byId<HTMLElement>('metric-progress').textContent = String(result.inquiries.in_progress || 0);
  byId<HTMLElement>('metric-waiting').textContent = String(result.inquiries.waiting || 0);
  const emailMetric = byId<HTMLElement>('metric-email');
  emailMetric.textContent = String(result.notifications.pending + result.notifications.dead);
  byId<HTMLElement>('email-caption').textContent = result.notifications.dead
    ? String(result.notifications.dead) + ' needs attention'
    : result.notifications.pending
      ? testEnvironment
        ? 'Captured by the test email queue'
        : 'Waiting to send'
      : testEnvironment
        ? 'Test email capture is active'
        : 'No queued notifications';
  const newCount = byId<HTMLElement>('new-count');
  newCount.textContent = String(result.inquiries.new || 0);
  return true;
}

let loadVersion = 0;
export async function loadInquiries(background = false, more = false) {
  const version = workspace.sessionVersion;
  const requestVersion = ++loadVersion;
  const filter = byId<HTMLSelectElement>('status-filter').value;
  if (filter !== lastFilter) {
    pages = 1;
    lastFilter = filter;
  }
  const records = new Map<string, Inquiry>();
  const target = more ? pages + 1 : pages;
  let cursor: string | null = null;
  let readPages = 0;
  for (let i = 0; i < target; i++) {
    const query = new URLSearchParams();
    if (filter) query.set('status', filter);
    if (cursor) query.set('cursor', cursor);
    const page: { inquiries: Inquiry[]; nextCursor: string | null } = await api(
      '/api/admin/inquiries?' + query,
    );
    page.inquiries.forEach((item) => records.set(item.id, item));
    cursor = page.nextCursor;
    readPages++;
    if (!cursor) break;
  }
  const result = { inquiries: [...records.values()] };
  if (!sessionCurrent(version) || requestVersion !== loadVersion) return;
  if (!(await loadSummary(version)) || !sessionCurrent(version) || requestVersion !== loadVersion)
    return;
  const changed = JSON.stringify(currentInquiries) !== JSON.stringify(result.inquiries);
  currentInquiries = result.inquiries;
  pages = readPages;
  if (changed || !background) renderInquiries();
  byId<HTMLElement>('inbox-updated-at').textContent =
    'Updated ' +
    new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date());
  byId<HTMLButtonElement>('inquiries-more').hidden = !cursor;
  if (background && selectedId) {
    // A new page of leads or a status filter can move the selected record out
    // of the list. Fetch that detail without discarding an unsaved note.
    const current =
      currentInquiries.find((item) => item.id === selectedId) ||
      (await api<{ inquiry: Inquiry }>('/api/admin/inquiries/' + encodeURIComponent(selectedId)))
        .inquiry;
    if (!sessionCurrent(version) || requestVersion !== loadVersion) return;
    if (current?.anonymizedAt) {
      await showDetail(selectedId);
      return;
    }
    const label = document.querySelector<HTMLElement>('[data-detail-status]');
    if (current && label) {
      label.textContent = 'Current status: ' + (statusLabels[current.status] || current.status);
      const locked = current.status === 'converted' || Boolean(current.anonymizedAt);
      for (const control of document.querySelectorAll<HTMLButtonElement | HTMLSelectElement>(
        '[data-save-status],[data-convert],.detail-status-select',
      ))
        control.disabled = locked;
      const select = document.querySelector<HTMLSelectElement>('.detail-status-select');
      if (select) {
        if (select.value === select.dataset.serverStatus || locked) select.value = current.status;
        select.dataset.serverStatus = current.status;
      }
      const delivery = document.querySelector<HTMLElement>('.notification-state > p');
      if (delivery && current.notification)
        delivery.textContent =
          current.notification.delivery_status === 'test_captured'
            ? 'Captured in test mode — no email was sent'
            : current.notification.delivery_status || current.notification.status;
    }
    await refreshNotes(selectedId);
    const history = document.querySelector<HTMLElement>('.event-box');
    if (history) await refreshHistory(selectedId, history);
  }
  // Background refresh must not replace a status choice the owner is editing.
  if (!background && selectedId && currentInquiries.some((item) => item.id === selectedId)) {
    await showDetail(selectedId);
  } else if (
    !background &&
    selectedId &&
    !currentInquiries.some((item) => item.id === selectedId)
  ) {
    selectedId = '';
    byId<HTMLElement>('inquiry-detail').replaceChildren(
      make('div', 'empty-detail', 'Select an inquiry to review it.'),
    );
  }
}
