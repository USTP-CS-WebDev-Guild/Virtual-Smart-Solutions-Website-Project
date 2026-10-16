// Curated messages explain sign-in failures without exposing credentials or raw responses.
export function loginErrorMessage(error: unknown): string {
  const detail =
    error && typeof error === 'object'
      ? (error as { code?: string; status?: number; name?: string })
      : {};

  if (detail.code === 'invalid_credentials') return 'Email or password did not match.';
  if (detail.code === 'email_not_confirmed') {
    return 'Confirm your email address before signing in. Contact the company owner if you need help.';
  }
  if (
    detail.status === 429 ||
    detail.code === 'over_request_rate_limit' ||
    detail.code === 'too_many_attempts'
  ) {
    return 'Too many sign-in attempts. Wait a few minutes, then try again.';
  }
  if (detail.name === 'AuthRetryableFetchError' || detail.name === 'TypeError') {
    return 'The sign-in service could not be reached. Check your connection and try again.';
  }
  if (
    detail.status === 401 ||
    detail.code === 'provider_disabled' ||
    detail.code === 'email_provider_disabled'
  ) {
    return 'Sign-in is unavailable. The company owner needs to check the sign-in configuration.';
  }
  return 'Sign-in could not be completed. Try again, or contact the company owner.';
}
