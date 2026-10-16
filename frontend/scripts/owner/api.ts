import { supabase } from './session';
import { showWorkspaceLogin } from './ui';

export class ContentValidationError extends Error {
  constructor(
    message: string,
    readonly section: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  const token = data.session?.access_token;
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options?.headers || {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(options?.method && options.method !== 'GET'
        ? { 'Content-Type': 'application/json', 'X-Requested-With': 'VSSDashboard' }
        : {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    fields?: Array<{ path: Array<string | number>; message: string }>;
  };
  if (!response.ok) {
    if (response.status === 401) {
      showWorkspaceLogin('Your session expired. Sign in again to continue.');
      throw new Error(
        'Staff access could not be verified. Refresh the page or contact the site owner.',
      );
    }
    if (body.error === 'invalid_site_content' && body.fields?.length) {
      const labels: Record<string, string> = {
        settings: 'Page copy',
        services: 'Services',
        faqs: 'Questions',
        plans: 'Packages',
        portfolio: 'Portfolio',
        team: 'Team',
      };
      const issues = body.fields.slice(0, 3).map((issue) => {
        const section = String(issue.path[1] || 'settings');
        const entry = typeof issue.path[2] === 'number' ? `, entry ${issue.path[2] + 1}` : '';
        return `${labels[section] || 'Website content'}${entry}: ${issue.message}`;
      });
      throw new ContentValidationError(
        'Please review before publishing. ' + issues.join(' '),
        String(body.fields[0]!.path[1] || 'settings'),
      );
    }
    throw new Error(body.error || 'The request could not be completed.');
  }
  return body as T;
}
