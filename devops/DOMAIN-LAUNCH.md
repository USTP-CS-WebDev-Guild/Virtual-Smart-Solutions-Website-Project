# Move the approved system to the client's domain

No stack migration is required. Netlify serves the website/API; Supabase remains the database/Auth/Realtime provider. The domain changes the public address. The client purchases/renews the domain and approves its ownership/billing contact. Hosting can remain within free allowances; a `.com` is not free.

## Before changing DNS

Finish RELEASE_CHECKLIST.md on staging. Confirm the business/privacy copy, prices, footer promises, genuine evidence and image permissions. Assign the client's domain owner plus student tech lead/DevOps maintainer. Record the current DNS records, previous primary domain, environment origins, successful deploy and backup location. Preserve mail-provider MX/TXT records.

## Connect the address

1. In the **live** Netlify site's domain settings, add the client's owned domain, plus its `www` counterpart if required. Choose one primary address, for example `https://www.CLIENT-DOMAIN.com`.
2. Use the DNS records/nameservers Netlify displays for this exact site. Do not copy a tutorial IP address: apex/`www` setup depends on the registrar and DNS provider. If changing nameservers, plan DNSSEC and existing email records with the domain owner before switching.
3. Wait for domain verification and a valid HTTPS certificate. Configure the other hostname as the provider's redirect to the chosen primary domain. Confirm HTTP also redirects to HTTPS. Do not enable a long-lived preload policy before every affected hostname is ready.
4. In live Netlify variables set `PUBLIC_SITE_URL` and `APP_ORIGIN` to the same primary HTTPS origin, with no trailing slash/path. Public URL is available at build; APP_ORIGIN at Functions runtime. Keep all live Supabase keys pointing at the live project. Redeploy.
5. In live Supabase Auth set **Site URL** to that same origin. Review redirect URLs if using password-reset/invitation email links: allow only actual application destinations that you support, not broad wildcards. The app's existing email/password sign-in needs no callback page.
6. Complete `../SECURITY-UPGRADE-1.6.0.md`: production UUID bindings/policy, `APP_ENV=production`, `PUBLIC_TEST_ENVIRONMENT=false`, real hCaptcha keys and Supabase Auth protection. Add the final hostnames to hCaptcha. Keep staging isolated with `APP_ENV=staging`/test=true. Check canonical, social-image and sitemap URLs plus exact-origin CSP after the new build. Avoid real collection under an unapproved privacy notice.
7. If enabling real notifications, verify the approved sending domain with the email provider (SPF/DKIM/DMARC per its instructions), configure Resend secrets and the signed webhook `/api/webhooks/resend`, then change `TEST_EMAIL_MODE` from `capture` to `send`. A public Gmail contact address alone is not a verified transactional sender. Mailbox service and website hosting are separate.

## Prove the cutover

Run `npm run verify:deployment -- https://www.CLIENT-DOMAIN.com` using the real address. Test root and `www`, HTTPS, incognito and a phone on cellular data. Public pages must open without Netlify login. Sign in as the live owner and test a synthetic contact receipt, already-open inbox delivery, CMS publication, staff restrictions, privacy handling and notification health. Remove/anonymize synthetic records according to the agreed policy.

Check any links pointing to the old `.netlify.app` address. Make sure its traffic redirects to the primary domain rather than accepting forms under an unapproved origin. Do not weaken `APP_ORIGIN`/CSRF checks to support arbitrary aliases. Keep staging on its own stable test URL.

If DNS is wrong, restore the recorded DNS/domain configuration with the domain owner; if application configuration is wrong, restore the prior deployment/origins. Leave the live database intact. DNS caches may delay recovery. Keep the old working address during a planned transition until verification passes.

## Maintenance after launch

Record registrar renewal date, auto-renew/payment owner, DNS/Netlify/Supabase account owners, live/staging URLs and deputy contacts in the team's restricted operations record. The source repository contains instructions and setting names, never credentials. Use MAINTENANCE-HANDOVER.md for routine releases and incidents.

Official references: [Netlify domains](https://docs.netlify.com/manage/domains/), [Supabase Auth URLs](https://supabase.com/docs/guides/auth/redirect-urls). Provider dashboard labels may change; use the values shown for the actual site.
