import { randomBytes, createHash } from 'node:crypto';
import { verifyLocalPassword } from './settings.mjs';
type Account = {
  id: string;
  email: string;
  role: string;
  salt: string;
  hash: string;
};
export function localSessions(accounts: Account[]) {
  const sessions = new Map<
    string,
    {
      account: Account;
      expires: number;
    }
  >();
  const attempts = new Map<
    string,
    {
      count: number;
      until: number;
    }
  >();
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');
  const lookup = (token: string) => {
    const record = sessions.get(hash(token));
    if (!record || record.expires < Date.now()) {
      sessions.delete(hash(token));
      return null;
    }
    return record.account;
  };
  return {
    lookup,
    login(email: string, password: string, ip: string) {
      const now = Date.now();
      const bucket = attempts.get(ip);
      if (bucket && bucket.until > now && bucket.count >= 10) return { error: 'too_many_attempts' };
      if (!bucket || bucket.until <= now) attempts.set(ip, { count: 1, until: now + 60000 });
      else bucket.count++;
      const account = accounts.find((item) => item.email === email.trim().toLowerCase());
      if (!account || !verifyLocalPassword(account, password))
        return { error: 'invalid_credentials' };
      attempts.delete(ip);
      const token = randomBytes(32).toString('base64url');
      sessions.set(hash(token), { account, expires: now + 8 * 60 * 60 * 1000 });
      for (const [key, value] of sessions) if (value.expires < now) sessions.delete(key);
      return {
        access_token: token,
        expires_at: Math.floor(now / 1000) + 8 * 60 * 60,
        user: { id: account.id, email: account.email },
      };
    },
    logout(token: string) {
      sessions.delete(hash(token));
    },
    getUser: async (token: string) => {
      const user = lookup(token);
      return {
        data: { user: user ? { id: user.id, email: user.email, email_confirmed_at: '2026-01-01T00:00:00Z', is_anonymous: false } : null },
        error: user ? null : new Error('invalid_token'),
      };
    },
  };
}
