# $0 operating plan and its limits

This project adds no required paid service, license, domain, or hosting CLI. Use Free plans and the included provider subdomain. Account terms can change; check usage and the links below at launch.

| Service  | Free use in this project                                                                        | Boundary                                                                                                                                                                                                                                                                               |
| -------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Netlify  | Public pages, API, published scheduled jobs, deploy previews from public student source         | Free credit plans currently include 300 monthly credits with a hard cap and no auto recharge. Exhaustion can pause sites; deploys and function runtime consume credits. Public-repository contributors are supported; private contributor/organization repo workflows can require Pro. |
| Supabase | Postgres, managed staff sign-in, and Realtime                                                   | Database, concurrent Realtime connections, messages, and egress have free quotas; a week of inactivity can trigger pausing, with two active Free projects allowed. There is no free uptime SLA or automatic backup service.                                                            |
| GitHub   | Public student template/team repos, restricted operational repos, CI within included allowances | Private Actions/artifact allowances apply. Keep any paid metered spending disabled. Required branch rules for private repos may require another plan; the two-repo workflow avoids depending on them.                                                                                  |
| Resend   | Optional provider, within its free send allowance                                               | Real business sending needs a verified sending domain. Default capture mode sends no email and needs no Resend account.                                                                                                                                                                |
| Domain   | Use the included `netlify.app` address                                                          | Purchasing a branded domain is outside the $0 plan.                                                                                                                                                                                                                                    |

The owner inbox stores inquiries even if notification delivery fails. Capture mode exercises the notification queue and records the capture state; it is not real outbound email. If no approved sending domain exists, the owner must check the inbox.

Keep provider accounts on Free, do not buy credit packs or enable paid spending, check monthly usage, and keep encrypted backups outside the database provider. A complete implementation with free quotas cannot promise permanent availability or commercial uptime guarantees.

## Official references (checked 2026-10-15)

- Netlify plans: https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/
- Netlify scheduled jobs: https://docs.netlify.com/build/functions/scheduled-functions/
- Supabase plans: https://supabase.com/pricing
- Supabase Realtime limits: https://supabase.com/docs/guides/realtime/limits
- Supabase free pausing: https://supabase.com/docs/guides/platform/free-project-pausing
- Supabase backups: https://supabase.com/docs/guides/platform/backups
- GitHub branch protections: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
