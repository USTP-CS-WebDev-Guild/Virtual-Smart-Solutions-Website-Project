// Owner workspace entrypoint: sign-in, navigation, and feature wiring.
import { supabase } from './session';
import { classroomMode } from '../../lib/supabase';
import { createMfaFlow } from './mfa';
import { attachCaptcha, captchaToken, resetCaptcha } from '../../lib/captcha';
import { api } from './api';
import { byId, make, setAlert, showWorkspaceLogin, setWorkspaceRole } from './ui';
import { loadInquiries, openInquiry, loadSummary, hasInquiryDraft } from './inquiries';
import { loadClients } from './clients';
import { loadPrivacyRequests } from './privacy';
import {
  loadSiteContent,
  addCmsCatalog,
  addCmsService,
  addCmsFaq,
  loadContentHistory,
  saveSiteContent,
} from './content-editor';
import { initializeContentNavigation } from './content-navigation';
import { loginErrorMessage } from './login-errors';
import { connectLiveUpdates, type LiveState } from '../../lib/live-updates';
import { workspace, type WorkspaceView } from './state';
import {
  markContentDirty,
  hasContentDraft,
  discardContentDraft,
  handleLiveContentChange,
} from './content-editor';

import { applyWorkspaceView, allowedView, initializeWorkspaceNavigation } from './navigation';
import { loadOverview } from './overview';
import { initializeSearch } from './search';
import { confirmAction } from './confirm';

function showView(view: WorkspaceView, refresh = true, push = true) {
  const target = applyWorkspaceView(allowedView(view), push);
  setAlert('');
  const report = (error: Error) => setAlert(error.message, 'error');
  if (target === 'overview') void loadOverview().catch(report);
  else if (target === 'clients') void loadClients().catch(report);
  else if (target === 'privacy') void loadPrivacyRequests().catch(report);
  else if (target === 'content') {
    if (!hasContentDraft()) void loadSiteContent().catch(report);
  } else if (target === 'settings') {
    void checkSubmissions();
    void loadSummary(workspace.sessionVersion).catch(report);
  } else if (refresh) void loadInquiries().catch(report);
}

let dashboardStarted = false;
let sessionCheckVersion = 0;
const mfa = supabase && !classroomMode ? createMfaFlow(supabase, checkStaffSession) : null;
window.addEventListener('vss-mfa-required', () => { void checkStaffSession(); });
let idleTimer: ReturnType<typeof setTimeout> | undefined;
const touchSession = () => {
  if (byId<HTMLElement>('admin-app').hidden) return;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    ++sessionCheckVersion;
    showWorkspaceLogin('Your workspace locked after inactivity. Sign in again.');
    void supabase?.auth.signOut();
  }, 15 * 60 * 1000);
};
for (const event of ['pointerdown', 'keydown', 'touchstart'])
  window.addEventListener(event, touchSession, { passive: true });

function startDashboard() {
  if (!dashboardStarted) {
    dashboardStarted = true;
    initializeContentNavigation();
    initializeWorkspaceNavigation(showView);
    for (const name of ['inquiry', 'client', 'privacy'])
      initializeSearch(
        name,
        () =>
          name === 'inquiry'
            ? loadInquiries()
            : name === 'client'
              ? loadClients()
              : loadPrivacyRequests(),
        (message) => setAlert(message, 'error'),
      );
    const filterInquiry = (value: string) => {
      byId<HTMLSelectElement>('status-filter').value = value;
      showView('inquiries');
    };
    document
      .querySelectorAll<HTMLButtonElement>('[data-inquiry-status],[data-status-choice]')
      .forEach((button) =>
        button.addEventListener('click', () => {
          if (button.hasAttribute('data-inquiry-status'))
            byId<HTMLInputElement>('inquiry-search').value = '';
          filterInquiry(button.dataset.inquiryStatus ?? button.dataset.statusChoice ?? '');
        }),
      );
    byId<HTMLButtonElement>('inquiry-clear-filters').addEventListener('click', () => {
      byId<HTMLInputElement>('inquiry-search').value = '';
      filterInquiry('');
    });
    byId<HTMLSelectElement>('client-status-filter').addEventListener('change', () => {
      void loadClients().catch((error) => setAlert(error.message, 'error'));
    });
    for (const kind of ['plans', 'portfolio', 'team'] as const)
      byId<HTMLButtonElement>('add-' + kind).addEventListener('click', () => addCmsCatalog(kind));
    byId<HTMLButtonElement>('add-service').addEventListener('click', addCmsService);
    byId<HTMLButtonElement>('add-faq').addEventListener('click', addCmsFaq);
    byId<HTMLButtonElement>('reload-site-content').addEventListener('click', async () => {
      if (
        !hasContentDraft() ||
        (await confirmAction(
          'Reload the latest website content?',
          'Your unpublished edits will be replaced by the latest saved content.',
          'Reload latest',
        ))
      ) {
        loadSiteContent().catch((error) => setAlert(error.message, 'error'));
      }
    });
    byId<HTMLButtonElement>('toggle-content-history').addEventListener('click', () => {
      const panel = byId<HTMLElement>('content-history');
      const isOpening = panel.classList.contains('is-hidden');
      panel.classList.toggle('is-hidden', !isOpening);
      if (isOpening) loadContentHistory().catch((error) => setAlert(error.message, 'error'));
    });
    byId<HTMLButtonElement>('save-site-content').addEventListener('click', () => {
      void saveSiteContent();
    });
    byId<HTMLSelectElement>('status-filter').addEventListener('change', () => {
      loadInquiries().catch((error) => setAlert(error.message, 'error'));
    });
    byId<HTMLButtonElement>('refresh-button').addEventListener('click', () => {
      refreshCurrentView().catch((error) => setAlert(error.message, 'error'));
    });
    byId<HTMLButtonElement>('inbox-refresh').addEventListener('click', () => {
      loadInquiries().catch((error) => setAlert(error.message, 'error'));
    });
    byId<HTMLButtonElement>('privacy-refresh').addEventListener('click', () => {
      loadPrivacyRequests().catch((error) => setAlert(error.message, 'error'));
    });
    byId<HTMLSelectElement>('privacy-filter').addEventListener('change', () => {
      loadPrivacyRequests().catch((error) => setAlert(error.message, 'error'));
    });
    byId<HTMLButtonElement>('privacy-more').addEventListener('click', () => {
      loadPrivacyRequests(true).catch((error) => setAlert(error.message, 'error'));
    });
    byId<HTMLButtonElement>('inquiries-more').addEventListener('click', () => {
      loadInquiries(false, true).catch((error) => setAlert(error.message, 'error'));
    });
    byId<HTMLButtonElement>('clients-refresh').addEventListener('click', () => {
      loadClients().catch((error) => setAlert(error.message, 'error'));
    });
    byId<HTMLButtonElement>('clients-more').addEventListener('click', () => {
      loadClients(true).catch((error) => setAlert(error.message, 'error'));
    });
    byId<HTMLElement>('content-view').addEventListener('input', markContentDirty);
    byId<HTMLElement>('content-view').addEventListener('change', markContentDirty);
    window.addEventListener('vss-open-inquiry', (event) => {
      const id = (event as CustomEvent<string>).detail;
      if (!/^[0-9a-f-]{36}$/i.test(id)) return;
      byId<HTMLInputElement>('inquiry-search').value = '';
      byId<HTMLSelectElement>('status-filter').value = '';
      showView('inquiries', false);
      void loadInquiries()
        .then(() => openInquiry(id))
        .catch((error) => setAlert(error.message, 'error'));
    });
    document.getElementById('check-submissions')?.addEventListener('click', () => {
      void checkSubmissions();
    });
    document.getElementById('verify-live-updates')?.addEventListener('click', () => {
      void verifyLiveDelivery();
    });

    const runTestJobsButton = document.getElementById('run-test-jobs') as HTMLButtonElement | null;
    runTestJobsButton?.addEventListener('click', async () => {
      const session = workspace.sessionVersion;
      runTestJobsButton.disabled = true;
      runTestJobsButton.textContent = 'Running jobs…';
      try {
        const result = await api<{ email: { processed: number; captured: number } }>(
          '/api/admin/test/run-jobs',
          {
            method: 'POST',
            body: JSON.stringify({}),
          },
        );
        if (session !== workspace.sessionVersion || byId<HTMLElement>('admin-app').hidden) return;
        await loadInquiries(true);
        setAlert(
          `Jobs completed. ${result.email.processed} notification(s) processed; ${result.email.captured} captured. Privacy retention was checked.`,
          'success',
        );
      } catch (error) {
        setAlert(error instanceof Error ? error.message : 'Could not run the test jobs.', 'error');
      } finally {
        runTestJobsButton.disabled = false;
        runTestJobsButton.textContent = 'Run test jobs';
      }
    });
  }
  byId<HTMLElement>('workspace-date').textContent = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());
  showView(allowedView(location.hash), true, false);
  startWorkspaceLive();
}

let stopLive: (() => void) | null = null;
let lastStaffRevision = -1;
window.addEventListener('vss-session-closed', () => {
  stopLive?.();
  stopLive = null;
  lastStaffRevision = -1;
  discardContentDraft();
  workspace.view = 'overview';
});
window.addEventListener('pagehide', () => {
  stopLive?.();
  stopLive = null;
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) void checkStaffSession();
});
window.addEventListener('beforeunload', (event) => {
  if (hasContentDraft() || hasInquiryDraft()) event.preventDefault();
});

async function refreshCurrentView() {
  if (workspace.view === 'overview') await loadOverview();
  else if (workspace.view === 'settings') {
    await checkSubmissions();
    await loadSummary(workspace.sessionVersion);
  } else if (workspace.view === 'clients') await loadClients();
  else if (workspace.view === 'privacy') await loadPrivacyRequests();
  else if (workspace.view === 'content') await handleLiveContentChange();
  else await loadInquiries();
}

function startWorkspaceLive() {
  stopLive?.();
  if (!supabase) return;
  const session = workspace.sessionVersion;
  const current = () =>
    session === workspace.sessionVersion && !byId<HTMLElement>('admin-app').hidden;
  const labels: Record<LiveState, string> = {
    connecting: 'Connecting live updates…',
    live: 'Live updates connected',
    reconnecting: 'Reconnecting live updates…',
    offline: 'Offline — reconnect to update',
    setup_required: 'Live updates need database setup',
  };
  stopLive = connectLiveUpdates(
    supabase,
    workspace.actorRole === 'owner' ? ['staff', 'owner', 'public'] : ['staff', 'public'],
    {
      verify: async () => (await api<{ ready: boolean }>('/api/admin/realtime-status')).ready,
      observed: (scope, revision) => {
        if (!current() || scope !== 'staff') return;
        lastStaffRevision = Math.max(lastStaffRevision, revision);
        window.dispatchEvent(new Event('vss-live-delivery'));
      },
      state: (state) => {
        if (!current()) return;
        const status = document.querySelector<HTMLElement>('.system-status');
        if (!status) return;
        status.className =
          'system-status' +
          (state === 'live' ? ' is-online' : state === 'connecting' ? '' : ' is-offline');
        status.replaceChildren(make('i'), document.createTextNode(' ' + labels[state]));
      },
      changed: async (scopes) => {
        if (!current()) return;
        const jobs: Promise<unknown>[] = [];
        if (scopes.has('staff')) {
          jobs.push(loadInquiries(true));
          if (workspace.view === 'overview') jobs.push(loadOverview());
          if (workspace.view === 'clients') jobs.push(loadClients());
        }
        if (scopes.has('owner') && workspace.actorRole === 'owner' && workspace.view === 'privacy')
          jobs.push(loadPrivacyRequests());
        if (
          scopes.has('public') &&
          workspace.actorRole === 'owner' &&
          (workspace.view === 'content' || hasContentDraft())
        )
          jobs.push(handleLiveContentChange());
        await Promise.all(jobs);
      },
    },
  );
}

async function verifyLiveDelivery() {
  const button = byId<HTMLButtonElement>('verify-live-updates');
  const session = workspace.sessionVersion;
  button.disabled = true;
  const started = performance.now();
  let cleanup = () => {};
  try {
    const result = await api<{ revision: number }>('/api/admin/test/live-check', {
      method: 'POST',
      body: '{}',
    });
    const target = Number(result.revision);
    if (!Number.isFinite(target))
      throw new Error('Live verification did not return a database revision.');
    await new Promise<void>((resolve, reject) => {
      const received = () => {
        if (session !== workspace.sessionVersion) {
          cleanup();
          reject(new Error('Sign in again to verify live delivery.'));
        } else if (lastStaffRevision >= target) {
          cleanup();
          resolve();
        }
      };
      const timer = window.setTimeout(() => {
        cleanup();
        reject(
          new Error(
            'The database update did not reach this browser. Check Realtime setup and WebSocket access.',
          ),
        );
      }, 15_000);
      cleanup = () => {
        window.clearTimeout(timer);
        window.removeEventListener('vss-live-delivery', received);
      };
      window.addEventListener('vss-live-delivery', received);
      received();
    });
    if (session === workspace.sessionVersion)
      setAlert(
        `Live delivery verified in ${Math.round(performance.now() - started)} ms. The database update reached this browser.`,
        'success',
      );
  } catch (error) {
    if (session === workspace.sessionVersion)
      setAlert(error instanceof Error ? error.message : 'Live verification failed.', 'error');
  } finally {
    cleanup();
    button.disabled = false;
  }
}

async function checkSubmissions() {
  const container = document.getElementById('submission-check-results');
  if (!container || workspace.actorRole !== 'owner') return;
  const version = workspace.sessionVersion;
  container.textContent = 'Checking contact form setup…';
  try {
    const result = await api<{
      ok: boolean;
      checks: Array<{ name: string; ok: boolean; message: string }>;
    }>('/api/admin/submission-checks');
    if (version !== workspace.sessionVersion || byId<HTMLElement>('admin-app').hidden) return;
    container.replaceChildren();
    for (const check of result.checks) {
      const row = make('div', 'check-row' + (check.ok ? '' : ' is-error'));
      row.append(make('span', 'check-indicator', check.ok ? '✓' : '!'));
      const text = make('div');
      text.append(make('strong', '', check.name), make('p', '', check.message));
      row.append(text);
      container.append(row);
    }
  } catch {
    if (version === workspace.sessionVersion && !byId<HTMLElement>('admin-app').hidden) {
      container.textContent =
        'Setup checks could not be completed. Check the API function log in Netlify.';
    }
  }
}

async function checkStaffSession() {
  const checkVersion = ++sessionCheckVersion;
  byId<HTMLElement>('admin-app').hidden = true;
  if (!supabase) {
    showWorkspaceLogin(
      'Owner sign-in is not configured. Add the public Supabase URL and anon key, then rebuild the site.',
    );
    return;
  }
  try {
    const { data: auth } = await supabase.auth.getSession();
    if (checkVersion !== sessionCheckVersion) return;
    if (!auth.session) {
      showWorkspaceLogin();
      return;
    }
    const response = await api<{
      authenticated: boolean;
      eligible?: boolean;
      mfaRequired?: boolean;
      user: { role: 'owner' | 'staff'; email?: string } | null;
    }>('/api/auth/session');
    // A sign-out in another tab must invalidate an in-flight staff check.
    if (checkVersion !== sessionCheckVersion) return;
    if (!response.authenticated && response.eligible && response.mfaRequired && mfa) {
      showWorkspaceLogin();
      await mfa.show();
      return;
    }
    if (!response.authenticated) {
      await supabase.auth.signOut();
      showWorkspaceLogin(
        'This account is not enabled for staff access. Ask the owner to check your staff account.',
      );
      return;
    }
    setWorkspaceRole(response.user?.role || 'staff');
    const email = response.user?.email || auth.session.user.email || '';
    byId<HTMLElement>('workspace-account-email').textContent = email;
    byId<HTMLElement>('settings-account-email').textContent = email;
    document.getElementById('workspace-skip-link')?.setAttribute('href', '#admin-main');
    byId<HTMLElement>('admin-login').hidden = true;
    byId<HTMLElement>('admin-app').hidden = false;
    startDashboard();
    touchSession();
  } catch (error) {
    showWorkspaceLogin(
      error instanceof Error ? error.message : 'Could not verify your staff account.',
    );
  }
}

byId<HTMLButtonElement>('toggle-password').addEventListener('click', () => {
  const input = byId<HTMLInputElement>('staff-password');
  const button = byId<HTMLButtonElement>('toggle-password');
  const visible = input.type === 'password';
  input.type = visible ? 'text' : 'password';
  button.textContent = visible ? 'Hide' : 'Show';
  button.setAttribute('aria-pressed', String(visible));
});

byId<HTMLInputElement>('staff-password').addEventListener('keyup', (event) => {
  byId<HTMLElement>('caps-lock-warning').hidden = !event.getModifierState('CapsLock');
});

const loginForm = byId<HTMLFormElement>('staff-login-form');
void attachCaptcha(loginForm);
loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = byId<HTMLElement>('staff-login-status');
  const button = loginForm.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!button) return;
  if (!supabase) {
    status.textContent = 'Owner sign-in is not configured. Ask the site owner to finish the setup.';
    return;
  }
  button.disabled = true;
  status.textContent = 'Checking account…';
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: byId<HTMLInputElement>('staff-email').value.trim(),
      password: byId<HTMLInputElement>('staff-password').value,
      options: { captchaToken: captchaToken(loginForm) || undefined },
    });
    if (error) {
      status.textContent = loginErrorMessage(error);
      return;
    }
    await checkStaffSession();
    if (!byId<HTMLElement>('admin-app').hidden) status.textContent = '';
  } catch (error) {
    status.textContent = loginErrorMessage(error);
  } finally {
    resetCaptcha(loginForm);
    button.disabled = false;
  }
});

// Enable only after the submit handler exists; never fall back to a GET with credentials.
const loginButton = loginForm.querySelector<HTMLButtonElement>('button[type="submit"]');
if (loginButton) loginButton.disabled = false;

byId<HTMLButtonElement>('sign-out').addEventListener('click', async () => {
  if (
    (hasContentDraft() || hasInquiryDraft()) &&
    !(await confirmAction(
      'Sign out with unsaved changes?',
      'Your unpublished website edits and unsaved notes will be discarded when you sign out.',
      'Sign out',
    ))
  )
    return;
  ++sessionCheckVersion;
  showWorkspaceLogin('Signing out…');
  await supabase?.auth.signOut();
  showWorkspaceLogin('You have signed out.');
});

// Keep the UI closed when Supabase expires the session or another tab signs out.
supabase?.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    clearTimeout(idleTimer);
    mfa?.hide();
    ++sessionCheckVersion;
    showWorkspaceLogin('You have signed out. Sign in again to continue.');
  }
});

void checkStaffSession();
