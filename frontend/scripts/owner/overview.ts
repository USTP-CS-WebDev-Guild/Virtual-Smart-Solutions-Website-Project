import { api } from './api';
import { byId, make, formatDate } from './ui';
import { workspace } from './state';
import type { Inquiry } from './types';

export type Summary = {
  actorRole: 'owner' | 'staff';
  inquiries: Record<string, number>;
  notifications: { pending: number; dead: number };
};
export function paintSummary(summary: Summary) {
  const values: Record<string, number> = {
    'metric-new': summary.inquiries.new || 0,
    'metric-progress': summary.inquiries.in_progress || 0,
    'metric-waiting': summary.inquiries.waiting || 0,
    'metric-converted': summary.inquiries.converted || 0,
    'new-count': summary.inquiries.new || 0,
    'metric-email': summary.notifications.pending + summary.notifications.dead,
  };
  for (const [id, count] of Object.entries(values)) {
    const node = document.getElementById(id);
    if (node) node.textContent = String(count);
  }
}
let version = 0;
export async function loadOverview() {
  const request = ++version;
  const session = workspace.sessionVersion;
  const [summary, recent] = await Promise.all([
    api<Summary>('/api/admin/summary'),
    api<{ inquiries: Inquiry[] }>('/api/admin/inquiries'),
  ]);
  if (
    request !== version ||
    session !== workspace.sessionVersion ||
    byId<HTMLElement>('admin-app').hidden
  )
    return;
  paintSummary(summary);
  const list = byId<HTMLElement>('overview-recent');
  list.replaceChildren();
  if (!recent.inquiries.length) {
    const empty = make('div', 'loading-state');
    empty.append(
      make('span', 'empty-state-icon', '↗'),
      make('h3', '', 'Your next opportunity starts here.'),
      make(
        'p',
        '',
        'New contact form submissions will appear here. You’ll have a clear place to follow up.',
      ),
    );
    list.append(empty);
    return;
  }
  const labels: Record<string, string> = {
    new: 'New',
    in_progress: 'In progress',
    waiting: 'Waiting',
    converted: 'Converted',
    closed: 'Closed',
  };
  for (const inquiry of recent.inquiries.slice(0, 6)) {
    const row = make('button', 'overview-recent-row');
    row.type = 'button';
    const avatar = make(
      'span',
      'contact-avatar',
      inquiry.name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase(),
    );
    avatar.setAttribute('aria-hidden', 'true');
    const copy = make('span', 'recent-row-copy');
    copy.append(make('strong', '', inquiry.name), make('small', '', inquiry.service));
    const end = make('span', 'recent-row-end');
    end.append(
      make(
        'span',
        'status-badge status-' + inquiry.status,
        labels[inquiry.status] || inquiry.status,
      ),
      make('time', '', formatDate(inquiry.createdAt)),
    );
    row.append(avatar, copy, end);
    row.addEventListener('click', () =>
      window.dispatchEvent(new CustomEvent('vss-open-inquiry', { detail: inquiry.id })),
    );
    list.append(row);
  }
}
