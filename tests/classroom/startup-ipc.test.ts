import { it, expect } from "vitest";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn, type ChildProcess } from "node:child_process";
import { API_STARTUP_TIMEOUT_MS, waitForApi } from "../../devops/scripts/wait-for-api.mjs";

async function shutdown(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode) return;
  await new Promise<void>((resolve, reject) => {
    const force = setTimeout(() => child.kill("SIGTERM"), 5000);
    const deadline = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("The test backend did not stop within 10 seconds."));
    }, 10_000);
    child.once("exit", () => {
      clearTimeout(force);
      clearTimeout(deadline);
      resolve();
    });
    if (child.connected) child.send("shutdown", () => {});
    else child.kill("SIGTERM");
  });
}

it("the real backend announces readiness only after PostgreSQL and HTTP are usable", async () => {
  // API integration only: no frontend/preview server or browser is launched.
  const root = await mkdtemp(join(tmpdir(), "vss-ready-"));
  const require = createRequire(import.meta.url);
  await cp(
    new URL("../../backend/database/migrations", import.meta.url),
    join(root, "backend/database/migrations"),
    { recursive: true },
  );
  const child = spawn(
    process.execPath,
    [
      "--import",
      pathToFileURL(require.resolve("tsx")).href,
      fileURLToPath(
        new URL("../../devops/scripts/classroom-backend.ts", import.meta.url),
      ),
    ],
    {
      cwd: root,
      env: { ...process.env, NETLIFY: "false", NODE_ENV: "development", API_PORT: "0" },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    },
  );
  // Drain child pipes without printing generated local accounts or records.
  child.stdout?.resume();
  let stderr = "";
  child.stderr?.on("data", (chunk) => { stderr = (stderr + chunk.toString()).slice(-4000); });
  try {
    const ready = await waitForApi(child, API_STARTUP_TIMEOUT_MS, 0) as { port: number };
    const base = "http://127.0.0.1:" + ready.port;
    const response = await fetch(base + "/api/health/ready", { signal: AbortSignal.timeout(5000) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ready" });
    expect(
      (await fetch(base + "/api/public/content", { signal: AbortSignal.timeout(5000) })).status,
    ).toBe(200);
    await shutdown(child);
    expect(child.exitCode).toBe(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backend readiness check failed.";
    throw new Error(message + (stderr ? "\nTest backend stderr:\n" + stderr : ""), { cause: error });
  } finally {
    await shutdown(child);
    await rm(root, { recursive: true, force: true });
  }
}, 120_000);
