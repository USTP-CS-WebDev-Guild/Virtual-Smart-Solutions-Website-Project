import type { PrivacyRequest } from './types';
import { api } from './api';
import { byId, formatDate, make, setAlert } from './ui';
import { workspace } from './state';
import { confirmAction } from './confirm';
let pages = 1;
let lastFilter = 'open';
let requestVersion = 0;
window.addEventListener('vss-session-closed', () => {
  ++requestVersion;
  pages = 1;
  lastFilter = 'open';
});

function renderPrivacyRequests(requests: PrivacyRequest[]) {
  const queue = byId<HTMLElement>('privacy-queue');
  const focused = document.activeElement;
  const focusedRequest =
    focused instanceof HTMLElement
      ? focused.closest<HTMLElement>('[data-request-id]')?.dataset.requestId
      : null;
  const focusedControl =
    focused instanceof HTMLTextAreaElement
      ? 'textarea'
      : focused instanceof HTMLSelectElement
        ? 'select'
        : focused instanceof HTMLInputElement
          ? 'input'
          : null;
  const selection =
    focused instanceof HTMLTextAreaElement ? [focused.selectionStart, focused.selectionEnd] : null;
  const drafts = new Map(
    Array.from(queue.querySelectorAll<HTMLElement>('[data-request-id]')).map((card) => [
      card.dataset.requestId!,
      {
        verified: card.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked || false,
        action: card.querySelector<HTMLSelectElement>('select')?.value,
        note: card.querySelector<HTMLTextAreaElement>('textarea')?.value || '',
      },
    ]),
  );
  queue.replaceChildren();
  if (!requests.length) {
    const empty = make('div', 'workspace-panel loading-state');
    empty.append(
      make('span', 'empty-state-icon', '✓'),
      make('h3', '', 'No requests in this view.'),
      make(
        'p',
        '',
        'Requests submitted through the privacy form appear here. Contact inquiries are managed in the inbox.',
      ),
    );
    queue.append(empty);
    return;
  }
  for (const request of requests) {
    const card = make('article', 'privacy-request-card');
    card.dataset.requestId = request.id;
    const content = make('div', 'privacy-request-content');
    const top = make('div', 'privacy-request-top');
    top.append(
      make('span', 'status-badge status-' + request.status, request.status.replaceAll('_', ' ')),
    );
    top.append(make('time', '', formatDate(request.createdAt)));
    const emailLink = make('a', 'privacy-request-email', request.email) as HTMLAnchorElement;
    emailLink.href = 'mailto:' + request.email;
    content.append(top, make('h3', '', request.name), emailLink);
    const type = make('p', 'request-type', request.requestType.replaceAll('_', ' '));
    const message = make('p', 'privacy-request-message', request.message);
    content.append(type, message);
    card.append(content);
    if (request.status === 'completed') {
      const audit = make('div', 'privacy-completion-audit');
      audit.append(make('p', 'eyebrow', 'COMPLETION RECORD'));
      audit.append(
        make(
          'p',
          '',
          'Action: ' + (request.completionAction || 'Not recorded').replaceAll('_', ' '),
        ),
      );
      audit.append(
        make(
          'p',
          '',
          'Completed ' +
            (request.completedAt ? formatDate(request.completedAt) : 'date unavailable') +
            (request.completedBy ? ' by ' + request.completedBy : ''),
        ),
      );
      audit.append(
        make(
          'p',
          '',
          request.identityVerifiedAt
            ? 'Requester identity verified'
            : 'Identity verification not recorded',
        ),
      );
      if (request.completionNote)
        audit.append(make('p', '', 'Handling note: ' + request.completionNote));
      card.append(audit);
    } else {
      if (workspace.actorRole !== 'owner') {
        card.append(
          make(
            'p',
            'owner-only-note',
            'Only the account owner can verify and complete privacy requests.',
          ),
        );
        queue.append(card);
        continue;
      }
      const controls = make('div', 'privacy-process-controls');
      const verifiedLabel = make('label', 'privacy-verify-label');
      const verified = make('input') as HTMLInputElement;
      verified.type = 'checkbox';
      verifiedLabel.append(
        verified,
        document.createTextNode(' I verified the requester’s identity'),
      );
      const actionLabel = make('label', 'privacy-action-label', 'ACTION TAKEN');
      const action = make('select', 'privacy-action-select') as HTMLSelectElement;
      const options =
        request.requestType === 'deletion'
          ? [
              ['delete_all_records', 'Anonymize all matching inquiry and client contact data'],
              ['delete_inquiry_records', 'Anonymize inquiry data; retain converted client records'],
              ['retained_under_policy', 'Retain records under a legal or contractual requirement'],
              ['handled_outside_system', 'Handled outside this system'],
            ]
          : [
              ['handled_as_requested', 'Access, export, or correction provided'],
              ['retained_under_policy', 'Retain records under a legal or contractual requirement'],
              ['handled_outside_system', 'Handled outside this system'],
            ];
      for (const [value, label] of options) {
        const option = make('option', '', label) as HTMLOptionElement;
        option.value = value;
        action.append(option);
      }
      actionLabel.append(action);
      const note = make('textarea', 'privacy-action-note') as HTMLTextAreaElement;
      note.rows = 2;
      note.maxLength = 1000;
      note.minLength = 10;
      note.placeholder =
        'Record the verification method and what was done (10 characters minimum).';
      note.setAttribute('aria-label', 'Completion notes');
      controls.append(verifiedLabel, actionLabel, note);
      const draft = drafts.get(request.id);
      if (draft) {
        verified.checked = draft.verified;
        if (draft.action) action.value = draft.action;
        note.value = draft.note;
      }
      card.append(controls);
      const complete = make(
        'button',
        'button button-dark',
        'Complete request',
      ) as HTMLButtonElement;
      const validate = () => {
        complete.disabled = !verified.checked || note.value.trim().length < 10;
      };
      verified.addEventListener('change', validate);
      note.addEventListener('input', validate);
      validate();
      complete.type = 'button';
      complete.addEventListener('click', async () => {
        if (!verified.checked || note.value.trim().length < 10) {
          setAlert(
            'Verify identity and add a completion note before recording this request.',
            'error',
          );
          return;
        }
        complete.disabled = true;
        const session = workspace.sessionVersion;
        const anonymize = action.value.startsWith('delete_');
        const accepted = await confirmAction(
          anonymize ? 'Anonymize matching records?' : 'Complete this privacy request?',
          anonymize
            ? 'This will remove personal details from matching stored records for ' +
                request.email +
                '. Review the selected scope before continuing. This action cannot be undone from the workspace.'
            : 'The selected action and your handling note will be recorded for ' +
                request.email +
                '.',
          anonymize ? 'Anonymize and complete' : 'Complete request',
          anonymize,
        );
        if (!accepted || session !== workspace.sessionVersion) {
          validate();
          return;
        }
        try {
          await api('/api/admin/privacy-requests/' + encodeURIComponent(request.id) + '/complete', {
            method: 'PATCH',
            body: JSON.stringify({
              identityVerified: true,
              action: action.value,
              note: note.value.trim(),
            }),
          });
          if (session !== workspace.sessionVersion || byId<HTMLElement>('admin-app').hidden) return;
          await loadPrivacyRequests();
          setAlert('Privacy request marked complete.', 'success');
        } catch (error) {
          setAlert(error instanceof Error ? error.message : 'Could not update request.', 'error');
          complete.disabled = false;
        }
      });
      card.append(complete);
    }
    queue.append(card);
  }
  if (focusedRequest && focusedControl) {
    const card = Array.from(queue.querySelectorAll<HTMLElement>('[data-request-id]')).find(
      (item) => item.dataset.requestId === focusedRequest,
    );
    const control = card?.querySelector<HTMLElement>(focusedControl);
    control?.focus({ preventScroll: true });
    if (control instanceof HTMLTextAreaElement && selection)
      control.setSelectionRange(selection[0]!, selection[1]!);
  }
}

export async function loadPrivacyRequests(more = false) {
  const session = workspace.sessionVersion;
  const version = ++requestVersion;
  const filter = byId<HTMLSelectElement>('privacy-filter').value;
  const search =
    (document.getElementById('privacy-search') as HTMLInputElement | null)?.value.trim() || '';
  const criteria = filter + '\n' + search;
  if (criteria !== lastFilter) {
    pages = 1;
    lastFilter = criteria;
  }
  const records = new Map<string, PrivacyRequest>();
  const target = more ? pages + 1 : pages;
  let cursor: string | null = null;
  let readPages = 0;
  for (let i = 0; i < target; i++) {
    const query = new URLSearchParams();
    if (filter) query.set('status', filter);
    if (search) query.set('q', search);
    if (cursor) query.set('cursor', cursor);
    const result: { requests: PrivacyRequest[]; nextCursor: string | null } = await api(
      '/api/admin/privacy-requests?' + query,
    );
    result.requests.forEach((row) => records.set(row.id, row));
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
  renderPrivacyRequests([...records.values()]);
  byId<HTMLButtonElement>('privacy-more').hidden = !cursor;
}
