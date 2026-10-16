import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import "./setup.mjs";
import { waitForApi } from "./wait-for-api.mjs";

// Everyday entry point: start both services, then stop both with Ctrl+C.
if (process.env.NETLIFY === "true" || process.env.NODE_ENV === "production") {
  throw new Error(
    "npm run dev is a workstation command. Deploy the Netlify build for a public website.",
  );
}
const cloud = process.argv.includes("--cloud");
if (cloud) {
  const check = spawnSync(
    process.execPath,
    ["--env-file-if-exists=.env", "devops/scripts/doctor.mjs", "--cloud"],
    { stdio: "inherit" },
  );
  if (check.status !== 0) process.exit(check.status || 1);
}

const require = createRequire(import.meta.url);
const astro = resolve(
  dirname(require.resolve("astro/package.json")),
  "bin/astro.mjs",
);
const env = {
  ...process.env,
  PUBLIC_CLASSROOM_MODE: cloud ? "false" : "true",
  PUBLIC_TEST_ENVIRONMENT: "true",
  ASTRO_DEV_BACKGROUND: "0",
};
if (!cloud) console.log(readFileSync(".local/LOCAL-ACCESS.md", "utf8"));
console.log(
  cloud
    ? "Cloud development: your own isolated Supabase test project."
    : "Classroom mode: persistent local PostgreSQL, local accounts, instant events, captured mail.",
);
console.log("Starting the database and API first…");

const backend = spawn(
  process.execPath,
  [
    "--env-file-if-exists=.env",
    "--import",
    "tsx",
    cloud
      ? "devops/scripts/dev-backend.ts"
      : "devops/scripts/classroom-backend.ts",
  ],
  { stdio: ["inherit", "inherit", "inherit", "ipc"], env },
);
let frontend;
let stopping = false;
let fallback;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  frontend?.kill("SIGTERM");
  // IPC lets Windows close PostgreSQL gracefully before the process exits.
  if (backend.connected) {
    backend.send("shutdown", () => {});
    fallback = setTimeout(() => backend.kill("SIGTERM"), 5000);
    fallback.unref();
  } else backend.kill("SIGTERM");
}
function watch(child, name) {
  child.once("error", () => {
    if (!stopping)
      console.error(
        `${name} could not start. Run npm ci and check that its port is free.`,
      );
    stop(1);
  });
  child.once("exit", (code) => {
    if (child === backend) clearTimeout(fallback);
    if (!stopping) {
      console.error(`${name} stopped. Closing the other service too.`);
      stop(code || 1);
    }
  });
}
watch(backend, "API");
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop());

try {
  await waitForApi(backend);
  if (!stopping) {
    console.log("API ready. Starting the website…");
    frontend = spawn(
      process.execPath,
      [astro, "dev", "--ignore-lock", "--host", "127.0.0.1", "--port", "4321"],
      { stdio: "inherit", env },
    );
    watch(frontend, "Website");
    console.log(
      "Owner sign-in: http://127.0.0.1:4321/admin/ — stop both services with Ctrl+C.",
    );
  }
} catch (error) {
  if (!stopping) console.error(error.message);
  stop(1);
}
