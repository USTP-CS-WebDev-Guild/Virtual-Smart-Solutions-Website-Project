import type { SupabaseClient } from '@supabase/supabase-js';

// No private business screen is opened until the API accepts an aal2 token.
export function createMfaFlow(client: SupabaseClient, completed: () => Promise<void>) {
  const panel = document.getElementById('staff-mfa')!;
  const heading = document.getElementById('staff-mfa-heading')!;
  const form = document.getElementById('staff-login-form')!;
  const status = document.getElementById('staff-mfa-status')!;
  const code = document.getElementById('staff-mfa-code') as HTMLInputElement;
  const setup = document.getElementById('staff-mfa-setup')!;
  const secret = document.getElementById('staff-mfa-secret') as HTMLInputElement;
  const qr = document.getElementById('staff-mfa-qr') as HTMLImageElement;
  const button = document.getElementById('staff-mfa-verify') as HTMLButtonElement;
  let factorId = '';
  let generation = 0;
  let creating: string | null = null;
  const hide = () => {
    ++generation;
    panel.hidden = true;
    form.hidden = false;
    code.value = ''; secret.value = ''; qr.removeAttribute('src');
    factorId = ''; creating = null;
  };
  const show = async () => {
    const current = ++generation;
    panel.hidden = false; form.hidden = true; setup.hidden = true;
    status.textContent = 'Checking your authenticator…';
    button.disabled = true;
    try {
      const listed = await client.auth.mfa.listFactors();
      if (listed.error) throw listed.error;
      if (current !== generation) return;
      const verified = listed.data.totp.find((factor) => factor.status === 'verified');
      if (verified) factorId = verified.id;
      else {
        // Reuse this screen's enrollment on a retried API check. Never silently
        // delete a verified factor or create factors on every refresh.
        if (!creating) {
          for (const pending of listed.data.all.filter((factor) =>
            factor.factor_type === 'totp' && factor.status === 'unverified' &&
            factor.friendly_name === 'VSS workspace')) {
            const removed = await client.auth.mfa.unenroll({ factorId: pending.id });
            if (removed.error) throw removed.error;
          }
          const enrolled = await client.auth.mfa.enroll({ factorType: 'totp',
            friendlyName: 'VSS workspace', issuer: 'Virtual Smart Solutions' });
          if (enrolled.error) throw enrolled.error;
          if (current !== generation) {
            await client.auth.mfa.unenroll({ factorId: enrolled.data.id });
            return;
          }
          creating = enrolled.data.id;
          secret.value = enrolled.data.totp.secret;
          const source = enrolled.data.totp.qr_code;
          // Supabase emits a rectangle for every QR module, including white
          // modules. Ordinary setup SVGs can exceed 150KB before compression.
          // Keep a bound without rejecting a normal provider enrollment.
          if (!/^data:image\/svg\+xml[;,]/.test(source) || source.length > 1000000)
            throw new Error('Invalid authenticator setup image');
          qr.src = source;
        }
        factorId = creating;
        setup.hidden = false;
      }
      heading.textContent = verified ? 'Enter your sign-in code' : 'Set up your authenticator';
      status.textContent = verified ? 'Enter the current code from your authenticator app. You do not need to scan the QR again.' :
        'After scanning the QR, enter the current code from your authenticator app to finish setup.';
      button.disabled = false;
      code.focus();
    } catch {
      if (current === generation)
        status.textContent = 'Authenticator setup could not finish. Sign out and retry, or contact the company owner.';
    }
  };
  document.getElementById('staff-mfa-form')!.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!factorId || !/^\d{6}$/.test(code.value.trim()) || button.disabled) return;
    const current = generation;
    button.disabled = true; status.textContent = 'Verifying…';
    try {
      const result = await client.auth.mfa.challengeAndVerify({ factorId, code: code.value.trim() });
      if (result.error) throw result.error;
      if (current !== generation) return;
      hide(); await completed();
    } catch {
      if (current === generation) {
        status.textContent = 'That code could not be verified. Use the current code and try again.';
        code.value = ''; code.focus();
      }
    } finally { button.disabled = false; }
  });
  document.getElementById('staff-mfa-cancel')!.addEventListener('click', async () => {
    const pending = creating;
    hide();
    // Only an unverified factor created by this screen is eligible for cleanup.
    if (pending) await client.auth.mfa.unenroll({ factorId: pending }).catch(() => {});
    await client.auth.signOut();
  });
  return { show, hide };
}
