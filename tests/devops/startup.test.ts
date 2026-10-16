import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { waitForApi } from "../../devops/scripts/wait-for-api.mjs";

afterEach(() => vi.useRealTimers());
describe("API before frontend startup", () => {
  it("starts the frontend only after the API confirms the correct listening port", async () => {
    const child = new EventEmitter();
    const startFrontend = vi.fn();
    const startup = waitForApi(child).then(startFrontend);
    await Promise.resolve();
    expect(startFrontend).not.toHaveBeenCalled();
    child.emit("message", { type: "database-opening" });
    await Promise.resolve();
    expect(startFrontend).not.toHaveBeenCalled();
    child.emit("message", { type: "api-ready", port: 8787 });
    await startup;
    expect(startFrontend).toHaveBeenCalledOnce();
    expect(child.listenerCount("message")).toBe(0);
    expect(child.listenerCount("exit")).toBe(0);
  });
  it("does not open a broken frontend after an API failure or wrong port", async () => {
    const child = new EventEmitter();
    const startFrontend = vi.fn();
    const startup = waitForApi(child).then(startFrontend);
    child.emit("message", { type: "api-ready", port: 9999 });
    await expect(startup).rejects.toThrow("port 8787");
    expect(startFrontend).not.toHaveBeenCalled();
    const failed = new EventEmitter();
    const result = waitForApi(failed);
    failed.emit("exit", 1);
    await expect(result).rejects.toThrow("stopped before");
  });
  it("stops waiting and removes listeners if backend startup stalls", async () => {
    vi.useFakeTimers();
    const child = new EventEmitter();
    const startup = waitForApi(child, 50);
    const rejected = expect(startup).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(51);
    await rejected;
    expect(child.listenerCount("message")).toBe(0);
    expect(child.listenerCount("error")).toBe(0);
  });
  it("allows a slow cold start without opening the frontend before readiness", async () => {
    vi.useFakeTimers();
    const child = new EventEmitter();
    const startFrontend = vi.fn();
    const startup = waitForApi(child).then(startFrontend);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(startFrontend).not.toHaveBeenCalled();
    child.emit("message", { type: "api-ready", port: 8787 });
    await startup;
    expect(startFrontend).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("accepts a real ephemeral test port but rejects invalid readiness ports", async () => {
    const child = new EventEmitter();
    const startup = waitForApi(child, 1000, 0);
    child.emit("message", { type: "api-ready", port: 49152 });
    await expect(startup).resolves.toMatchObject({ port: 49152 });
    for (const port of [0, -1, 65536, "8787"]) {
      const invalid = new EventEmitter();
      const pending = waitForApi(invalid, 1000, 0);
      invalid.emit("message", { type: "api-ready", port });
      await expect(pending).rejects.toThrow("invalid listening port");
    }
  });
  it("fails immediately if the backend already exited instead of waiting for its deadline", async () => {
    const child = Object.assign(new EventEmitter(), { exitCode: 1, signalCode: null });
    await expect(waitForApi(child)).rejects.toThrow("exit 1");
    expect(child.listenerCount("message")).toBe(0);
    expect(child.listenerCount("error")).toBe(0);
    expect(child.listenerCount("exit")).toBe(0);
  });
});
