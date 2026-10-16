// The API sends this message only after migrations and listen() finish.
// Do not start Astro until it can accept the first browser/event request.
export const API_STARTUP_TIMEOUT_MS = 90_000;

// An expectedPort of 0 is reserved for integration tests that ask the OS for
// a free port. The normal dev command still requires the proxy's port 8787.
export function waitForApi(child, timeoutMs = API_STARTUP_TIMEOUT_MS, expectedPort = 8787) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      child.off("message", onMessage);
      child.off("exit", onExit);
      child.off("error", onError);
    };
    const fail = (message) => {
      cleanup();
      reject(new Error(message));
    };
    const onMessage = (message) => {
      if (message?.type !== "api-ready") return;
      if (!Number.isInteger(message.port) || message.port < 1 || message.port > 65535)
        return fail("The API reported an invalid listening port.");
      if (expectedPort !== 0 && message.port !== expectedPort)
        return fail(`The API must use port ${expectedPort} to match the frontend proxy.`);
      cleanup();
      resolve(message);
    };
    const onExit = (code, signal) =>
      fail(`The API stopped before it became ready (${signal ? "signal " + signal : "exit " + code}). Read the backend startup error.`);
    const onError = () =>
      fail("The API process could not start. Run npm ci, then retry.");
    const timer = setTimeout(
      () =>
        fail(
          `API startup timed out after ${Math.ceil(timeoutMs / 1000)} seconds. Database initialization or HTTP startup did not finish. Read the backend startup output.`,
        ),
      timeoutMs,
    );
    child.on("message", onMessage);
    child.once("exit", onExit);
    child.once("error", onError);
    if (typeof child.exitCode === "number" || child.signalCode)
      onExit(child.exitCode, child.signalCode);
  });
}
