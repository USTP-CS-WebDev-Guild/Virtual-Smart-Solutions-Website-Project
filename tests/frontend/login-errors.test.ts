import { describe, expect, it } from 'vitest';
import { loginErrorMessage } from '../../frontend/scripts/owner/login-errors';

describe('owner sign-in feedback', () => {
  it('keeps invalid credentials generic without identifying whether an account exists', () => {
    expect(loginErrorMessage({ code: 'invalid_credentials', status: 400 })).toBe(
      'Email or password did not match.',
    );
  });

  it('distinguishes confirmation, configuration, rate limits, and connection failures', () => {
    expect(loginErrorMessage({ code: 'email_not_confirmed' })).toContain('Confirm your email');
    expect(loginErrorMessage({ status: 401 })).toContain('configuration');
    expect(loginErrorMessage({ status: 429 })).toContain('Too many sign-in attempts');
    expect(loginErrorMessage({ name: 'AuthRetryableFetchError' })).toContain(
      'could not be reached',
    );
  });

  it('never displays an arbitrary provider response or credential', () => {
    const text = loginErrorMessage({
      message: 'private-provider-response',
      access_token: 'private-token',
    });
    expect(text).not.toContain('private');
    expect(text).toContain('could not be completed');
    expect(loginErrorMessage(null)).toBe(text);
  });
});
