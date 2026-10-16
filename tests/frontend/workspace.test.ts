// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { workspace } from '../../frontend/scripts/owner/state';
import {
  allowedView,
  applyWorkspaceView,
  initializeWorkspaceNavigation,
} from '../../frontend/scripts/owner/navigation';
import { setWorkspaceRole, showWorkspaceLogin } from '../../frontend/scripts/owner/ui';
import {
  loadInquiries,
  openInquiry,
  hasInquiryDraft,
} from '../../frontend/scripts/owner/inquiries';
import {
  loadSiteContent,
  markContentDirty,
  saveSiteContent,
} from '../../frontend/scripts/owner/content-editor';
import { DEFAULT_SITE_CONTENT } from '../../shared/site-content/defaults';
const mock = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('../../frontend/scripts/owner/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../frontend/scripts/owner/api')>()),
  api: mock.api,
}));
const id = '10000000-0000-4000-8000-000000000001';
const nextId = '10000000-0000-4000-8000-000000000002';
const inquiry = (key = id, name = 'Synthetic Contact') => ({
  id: key,
  name,
  email: 'contact@example.test',
  company: 'Example Business',
  phone: '',
  service: 'Virtual Assistant',
  message: 'Please discuss inbox support.',
  status: 'new',
  possibleDuplicate: false,
  createdAt: 1000,
  updatedAt: 1000,
  anonymizedAt: null,
  notification: null,
});
function fixture() {
  document.body.innerHTML = `<div id="admin-login" hidden><input id="staff-password" type="password"><button id="toggle-password">Show</button><p id="staff-login-status"></p></div>
  <a id="workspace-skip-link"></a><div id="admin-app"><aside id="workspace-navigation"><a href="/">Website</a><button id="workspace-menu-close">Close</button>${['overview', 'inquiries', 'clients', 'privacy', 'content', 'settings'].map((v) => `<button class="admin-nav-item" ${v === 'content' ? 'id="content-nav"' : ''} data-view="${v}" ${['privacy', 'content', 'settings'].includes(v) ? 'data-owner-only' : ''}>${v}</button>`).join('')}</aside><button id="workspace-nav-backdrop" hidden></button><main id="admin-main"><button id="workspace-menu-toggle" aria-expanded="false"></button><h1 id="page-heading"></h1><div id="admin-alert"></div>${['overview', 'inquiries', 'clients', 'privacy', 'content', 'settings'].map((v) => `<section class="admin-view" id="${v}-view"></section>`).join('')}<span class="system-status"></span><p id="workspace-account-role"></p><p id="workspace-account-email"></p><p id="settings-account-email"></p></main></div>
  <div id="overview-recent"></div><div id="inquiry-list"></div><div id="inquiry-detail"></div><select id="status-filter"><option value="">All</option><option value="new">New</option><option value="waiting">Waiting</option></select><input id="inquiry-search"><button id="inquiry-clear-filters"></button><p id="inquiry-result-count"></p><p id="inbox-updated-at"></p><button id="inquiries-more"></button><div id="client-list"></div><div id="privacy-queue"></div><section class="test-jobs-panel"><div id="submission-check-results"></div></section>
  ${['new', 'progress', 'waiting', 'email', 'converted'].map((v) => `<strong id="metric-${v}"></strong>`).join('')}<span id="email-caption"></span><span id="new-count"></span>
  <dialog id="workspace-confirm"><h2 id="confirm-title"></h2><p id="confirm-description"></p><button id="confirm-accept"></button></dialog>`;
  document.getElementById('content-view')!.innerHTML =
    `<p id="content-draft-status"></p><p id="content-update-notice" hidden></p><p id="content-revision"></p><button id="save-site-content"></button><div id="content-history"></div><div id="cms-settings-fields"></div><div id="cms-services"></div><div id="cms-faqs"></div><div id="cms-plans"></div><div id="cms-portfolio"></div><div id="cms-team"></div>`;
}
beforeEach(() => {
  fixture();
  ++workspace.sessionVersion;
  window.dispatchEvent(new Event('vss-session-closed'));
  workspace.actorRole = 'owner';
  workspace.view = 'overview';
  document.getElementById('admin-app')!.hidden = false;
  mock.api.mockReset().mockImplementation(async (path: string) => {
    if (path === '/api/admin/summary')
      return { actorRole: 'owner', inquiries: { new: 2 }, notifications: { pending: 0, dead: 0 } };
    if (path.includes('/notes')) return { notes: [] };
    if (path.includes('/events')) return { events: [] };
    if (path.startsWith('/api/admin/inquiries?'))
      return { inquiries: [inquiry(), inquiry(nextId, 'Another Contact')], nextCursor: null };
    if (path === '/api/admin/site-content')
      return { content: structuredClone(DEFAULT_SITE_CONTENT), revision: 0, updatedAt: null };
    throw new Error('Unexpected fixture call ' + path);
  });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  history.replaceState(null, '', '#overview');
});
describe('owner workspace navigation and access', () => {
  it('validates deep links and keeps owner-only panels unavailable to staff', () => {
    for (const invalid of ['constructor', 'toString', '__proto__', 'unknown'])
      expect(allowedView(invalid)).toBe('overview');
    expect(allowedView('#content', 'staff')).toBe('overview');
    expect(allowedView('#clients', 'staff')).toBe('clients');
    setWorkspaceRole('staff');
    expect(document.getElementById('content-nav')!.hidden).toBe(true);
    applyWorkspaceView('privacy');
    expect(workspace.view).toBe('overview');
    expect(document.getElementById('privacy-view')!.hidden).toBe(true);
  });
  it('switches one panel at a time, updates the title and active navigation, and keeps browser history', () => {
    applyWorkspaceView('clients');
    expect(document.getElementById('page-heading')!.textContent).toBe('Clients');
    expect(document.querySelectorAll('.admin-view:not([hidden])')).toHaveLength(1);
    expect(location.hash).toBe('#clients');
    expect(document.querySelector('[data-view=clients]')!.getAttribute('aria-current')).toBe(
      'page',
    );
  });
  it('opens the mobile drawer, prevents interacting with the page beneath it, and restores focus on Escape', () => {
    initializeWorkspaceNavigation(vi.fn());
    document.getElementById('workspace-menu-toggle')!.click();
    expect(document.getElementById('admin-main')!.inert).toBe(true);
    expect(document.body.dataset.navigationOpen).toBe('true');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('admin-main')!.inert).toBe(false);
    expect(document.activeElement?.id).toBe('workspace-menu-toggle');
  });
  it('clears private content from every view when the session ends', () => {
    for (const key of [
      'overview-recent',
      'client-list',
      'cms-plans',
      'cms-portfolio',
      'cms-team',
      'inquiry-list',
    ])
      document.getElementById(key)!.textContent = 'Private contact details';
    showWorkspaceLogin('Please sign in again.');
    expect(document.getElementById('admin-app')!.hidden).toBe(true);
    for (const key of [
      'overview-recent',
      'client-list',
      'cms-plans',
      'cms-portfolio',
      'cms-team',
      'inquiry-list',
    ])
      expect(document.getElementById(key)!.textContent).toBe('');
    expect(document.getElementById('admin-login')!.hidden).toBe(false);
  });
});
describe('inquiry drafts and safe rendering', () => {
  it('preserves an unsaved note when another record is opened and during live refreshes', async () => {
    await loadInquiries();
    await openInquiry(id);
    const input = document.querySelector<HTMLTextAreaElement>('[name=note]')!;
    input.value = 'Keep this unsaved follow-up.';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await openInquiry(nextId);
    await openInquiry(id);
    expect(document.querySelector<HTMLTextAreaElement>('[name=note]')!.value).toBe(
      'Keep this unsaved follow-up.',
    );
    await loadInquiries(true);
    expect(document.querySelector<HTMLTextAreaElement>('[name=note]')!.value).toBe(
      'Keep this unsaved follow-up.',
    );
    expect(hasInquiryDraft()).toBe(true);
  });
  it('renders untrusted customer content as text and provides a real email action', async () => {
    mock.api.mockImplementation(async (path: string) =>
      path.includes('summary')
        ? { actorRole: 'owner', inquiries: { new: 1 }, notifications: { pending: 0, dead: 0 } }
        : path.includes('/notes')
          ? { notes: [] }
          : path.includes('/events')
            ? { events: [] }
            : { inquiries: [inquiry(id, '<img src=x onerror=alert(1)>')], nextCursor: null },
    );
    await loadInquiries();
    await openInquiry(id);
    expect(document.querySelector('#inquiry-detail img')).toBeNull();
    expect(document.querySelector('#inquiry-detail h2')!.textContent).toContain('<img');
    expect(document.querySelector<HTMLAnchorElement>('.detail-primary-actions a')!.href).toContain(
      'mailto:contact@example.test',
    );
  });
  it('does not convert an inquiry when confirmation is cancelled', async () => {
    const dialog = document.getElementById('workspace-confirm') as HTMLDialogElement;
    dialog.showModal = () => {
      dialog.open = true;
    };
    dialog.close = (value = '') => {
      dialog.returnValue = value;
      dialog.open = false;
      dialog.dispatchEvent(new Event('close'));
    };
    await loadInquiries();
    await openInquiry(id);
    document.querySelector<HTMLButtonElement>('[data-convert]')!.click();
    await Promise.resolve();
    expect(dialog.open).toBe(true);
    dialog.close('cancel');
    await Promise.resolve();
    expect(mock.api.mock.calls.some(([path]) => String(path).endsWith('/convert'))).toBe(false);
  });
});
describe('publishing protects the owner’s latest draft', () => {
  it('groups fields by page and exposes an explicit unpublished-changes state', async () => {
    await loadSiteContent();
    expect(document.querySelectorAll('[data-settings-group]').length).toBeGreaterThan(5);
    const field = document.querySelector<HTMLInputElement>('[data-setting=homeHeadline]')!;
    field.value = 'An unpublished heading';
    markContentDirty();
    expect(document.getElementById('content-draft-status')!.textContent).toContain('unpublished');
    expect((document.getElementById('save-site-content') as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
  it('keeps an older response from replacing newer content or edits', async () => {
    let finish!: (result: unknown) => void;
    mock.api.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const older = loadSiteContent();
    await loadSiteContent();
    const field = document.querySelector<HTMLInputElement>('[data-setting=homeHeadline]')!;
    field.value = 'Keep my newest work';
    markContentDirty();
    finish({ content: structuredClone(DEFAULT_SITE_CONTENT), revision: 0, updatedAt: null });
    await older;
    expect(document.querySelector<HTMLInputElement>('[data-setting=homeHeadline]')!.value).toBe(
      'Keep my newest work',
    );
  });
  it('disables editor controls while publishing and ignores a response after sign-out', async () => {
    await loadSiteContent();
    markContentDirty();
    let finish!: (result: unknown) => void;
    mock.api.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const saved = saveSiteContent();
    expect(document.querySelector<HTMLInputElement>('[data-setting=businessName]')!.disabled).toBe(
      true,
    );
    showWorkspaceLogin();
    finish({ content: structuredClone(DEFAULT_SITE_CONTENT), revision: 1, updatedAt: Date.now() });
    await saved;
    expect(document.getElementById('cms-settings-fields')!.children).toHaveLength(0);
    expect(document.getElementById('admin-app')!.hidden).toBe(true);
  });
});
