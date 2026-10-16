/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_CLASSROOM_MODE?: string;
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_ANON_KEY?: string;
  readonly PUBLIC_TEST_ENVIRONMENT?: string;
}
