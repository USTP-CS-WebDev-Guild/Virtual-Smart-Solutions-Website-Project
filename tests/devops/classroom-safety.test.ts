import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";
import {
  ensureLocalSettings,
  verifyLocalPassword,
} from "../../devops/local/settings.mjs";

it("gives each clone different stable accounts, stores hashes, and archives data only after dev stops", async () => {
  const root = mkdtempSync(join(tmpdir(), "student-reset-"));
  const other = mkdtempSync(join(tmpdir(), "student-other-"));
  const reset = fileURLToPath(
    new URL("../../devops/scripts/reset-local.mjs", import.meta.url),
  );
  try {
    const first = await ensureLocalSettings(root);
    const second = await ensureLocalSettings(other);
    expect(first.accounts[0].hash).not.toBe(second.accounts[0].hash);
    expect(await ensureLocalSettings(root)).toEqual(first);
    const guide = readFileSync(join(root, ".local/LOCAL-ACCESS.md"), "utf8");
    const password = guide.match(/Password: (\S+)/)![1]!;
    expect(verifyLocalPassword(first.accounts[0], password)).toBe(true);
    expect(
      readFileSync(join(root, ".local/accounts.json"), "utf8"),
    ).not.toContain(password);
    writeFileSync(
      join(root, ".local/saved-record.txt"),
      "my synthetic saved record",
    );
    expect(spawnSync(process.execPath, [reset], { cwd: root }).status).not.toBe(
      0,
    );
    writeFileSync(join(root, ".local/server.lock"), String(process.pid));
    expect(
      spawnSync(process.execPath, [reset, "--confirm-local-data"], {
        cwd: root,
      }).status,
    ).not.toBe(0);
    unlinkSync(join(root, ".local/server.lock"));
    expect(
      spawnSync(process.execPath, [reset, "--confirm-local-data"], {
        cwd: root,
      }).status,
    ).toBe(0);
    const archive = readdirSync(join(root, ".classroom-backups"))[0]!;
    expect(
      readFileSync(
        join(root, ".classroom-backups", archive, "saved-record.txt"),
        "utf8",
      ),
    ).toBe("my synthetic saved record");
    expect(
      readFileSync(
        join(root, ".classroom-backups", archive, "LOCAL-ACCESS.md"),
        "utf8",
      ),
    ).toBe(guide);
    expect((await ensureLocalSettings(root)).accounts[0].id).not.toBe(
      first.accounts[0].id,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(other, { recursive: true, force: true });
  }
});

it("hosting build preflight rejects classroom mode and private keys in browser configuration", () => {
  const preflight = fileURLToPath(
    new URL("../../devops/scripts/build-preflight.mjs", import.meta.url),
  );
  const check = (overrides: Record<string, string>) =>
    spawnSync(process.execPath, [preflight], {
      env: {
        ...process.env,
        NETLIFY: "true",
        APP_ENV: "staging",
        PUBLIC_TEST_ENVIRONMENT: "true",
        PUBLIC_SITE_URL: "https://synthetic.example",
        PUBLIC_SUPABASE_URL: "https://synthetic.supabase.co",
        SUPABASE_URL: "https://synthetic.supabase.co",
        PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_SYNTHETIC_NOT_A_KEY",
        PUBLIC_CLASSROOM_MODE: "false",
        ...overrides,
      },
      encoding: "utf8",
    });
  expect(check({}).status).toBe(0);
  expect(check({ PUBLIC_CLASSROOM_MODE: "true" }).status).not.toBe(0);
  expect(
    check({ PUBLIC_SUPABASE_ANON_KEY: "sb_secret_SYNTHETIC_NOT_A_KEY" }).status,
  ).not.toBe(0);
  expect(check({ PUBLIC_SITE_URL: "" }).status).not.toBe(0);
  expect(
    check({ PUBLIC_SITE_URL: "https://synthetic.example/wrong-path" }).status,
  ).not.toBe(0);
  expect(check({ PUBLIC_TEST_ENVIRONMENT: "yes" }).status).not.toBe(0);
  expect(check({ APP_ENV: "" }).status).not.toBe(0);
  expect(check({ APP_ENV: "production" }).status).not.toBe(0);
  expect(check({ APP_ENV: "production", PUBLIC_TEST_ENVIRONMENT: "false" }).status).not.toBe(0);
  expect(check({ APP_ENV: "production", PUBLIC_TEST_ENVIRONMENT: "false", PUBLIC_HCAPTCHA_SITE_KEY: "10000000-ffff-ffff-ffff-000000000001" }).status).not.toBe(0);
  expect(check({ APP_ENV: "production", PUBLIC_TEST_ENVIRONMENT: "false", PUBLIC_HCAPTCHA_SITE_KEY: "10000000-0000-4000-8000-000000000001" }).status).toBe(0);
  expect(check({ PUBLIC_UNEXPECTED_SETTING: "sb_secret_SYNTHETIC_NOT_A_KEY" }).status).not.toBe(0);
});
