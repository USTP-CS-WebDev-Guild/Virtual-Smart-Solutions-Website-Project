if (
  process.env.NETLIFY === "true" &&
  process.env.PUBLIC_CLASSROOM_MODE === "true"
)
  throw new Error(
    "Classroom mode cannot be deployed. Configure your own Supabase project and remove PUBLIC_CLASSROOM_MODE from hosting variables.",
  );
function publicKey(value) {
  if (value.startsWith("sb_secret_")) return false;
  if (value.startsWith("sb_publishable_")) return true;
  try {
    return (
      JSON.parse(Buffer.from(value.split(".")[1] || "", "base64url").toString())
        .role === "anon"
    );
  } catch {
    return false;
  }
}
const key = process.env.PUBLIC_SUPABASE_ANON_KEY || "";
if (key && !publicKey(key))
  throw new Error(
    "PUBLIC_SUPABASE_ANON_KEY must be a publishable/anon key. Build stopped before a private key could enter browser files.",
  );
if (process.env.NETLIFY === "true") {
  for (const name of [
    "PUBLIC_SUPABASE_URL",
    "PUBLIC_SUPABASE_ANON_KEY",
    "PUBLIC_TEST_ENVIRONMENT",
    "PUBLIC_SITE_URL",
  ]) {
    if (!process.env[name])
      throw new Error(
        `Set ${name} in Netlify environment variables before deploying the complete system.`,
      );
  }
}
if (
  process.env.PUBLIC_TEST_ENVIRONMENT &&
  !["true", "false"].includes(process.env.PUBLIC_TEST_ENVIRONMENT)
)
  throw new Error("PUBLIC_TEST_ENVIRONMENT must be true or false.");
if (process.env.PUBLIC_SITE_URL) {
  let valid = false;
  try {
    const site = new URL(process.env.PUBLIC_SITE_URL);
    valid =
      site.protocol === "https:" &&
      site.pathname === "/" &&
      !site.search &&
      !site.hash &&
      !site.username &&
      !site.password;
  } catch {
    /* Report a setting name, not its contents. */
  }
  if (!valid)
    throw new Error(
      "PUBLIC_SITE_URL must be a clean HTTPS origin, without a path, query or credentials.",
    );
}
if (
  process.env.PUBLIC_SUPABASE_URL &&
  process.env.SUPABASE_URL &&
  process.env.PUBLIC_SUPABASE_URL.replace(/\/$/, "") !==
    process.env.SUPABASE_URL.replace(/\/$/, "")
) {
  throw new Error("Browser and backend Supabase URLs do not match.");
}
