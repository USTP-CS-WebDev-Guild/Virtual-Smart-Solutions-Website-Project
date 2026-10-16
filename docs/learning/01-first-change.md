# 1. Make one visible source change

Goal: locate a component and distinguish starting copy from published data.

1. Run `npm run dev`. Open the home page and contact page.
2. Open `frontend/components/InquiryForm.astro`. Find the helper sentence under the button. Rewrite it to be clearer, keeping its meaning. Save and see Astro update the page.
3. Open `shared/site-content/defaults.ts`. Find `settings.businessName` and `homeHeadline`. These are the starting text for a fresh project. Published database revisions take precedence; use the Website editor if you already published content.
4. Look at `frontend/pages/contact.astro` to see where the form is used. Look at `frontend/components/Brand.astro` for the shared logo/name.
5. At phone width, send a synthetic inquiry and check its saved reference and owner inbox.

Evidence for your PR: changed file path, before/after screenshot, and one successful real form save. Run `npm run test:frontend` and `npm run check`. Do not change login or SQL for this exercise.
