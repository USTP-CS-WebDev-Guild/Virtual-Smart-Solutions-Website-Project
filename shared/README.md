# Shared contracts

`site-content/defaults.ts` contains the public content fallback and its TypeScript types. `site-content/validation.ts` is the Zod contract used when an owner publishes the live website editor. Change both together when the content model changes, and add a test for the new constraint.

`release.ts` holds the application release marker used by pages and runtime diagnostics. Keep it aligned with `package.json` and the deployment verifier when releasing.
