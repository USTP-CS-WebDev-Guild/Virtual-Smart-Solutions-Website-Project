import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { createApplication } from "../../backend/app";
import { verifyResendWebhook } from "../../backend/security/email-signature";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe("safe errors and signed provider boundaries", () => {
  it("does not echo provider/customer exception text into application logs or responses", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const privateText = "customer-private@example.test Bearer private-token";
    const app = createApplication(() => {
      throw new Error(privateText);
    });
    const response = await app(
      new Request("https://site.example/api/public/content"),
    );
    expect(response.status).toBe(503);
    expect(JSON.stringify(log.mock.calls)).not.toContain(privateText);
    expect(await response.text()).not.toContain(privateText);
    expect(response.headers.get("X-Request-ID")).toBeTruthy();
  });
  it("verifies the raw signature and rejects expired or excessive header values", async () => {
    const key = Buffer.alloc(32, 7);
    const raw = '{"type":"email.delivered"}';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const id = "synthetic-event";
    const signature = createHmac("sha256", key)
      .update(`${id}.${timestamp}.${raw}`)
      .digest("base64");
    const headers = new Headers({
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": "v1," + signature,
    });
    const secret = "whsec_" + key.toString("base64");
    expect(await verifyResendWebhook(raw, headers, secret)).toBe(true);
    expect(await verifyResendWebhook(raw + " ", headers, secret)).toBe(false);
    headers.set("svix-id", "x".repeat(201));
    expect(await verifyResendWebhook(raw, headers, secret)).toBe(false);
    headers.set("svix-id", id);
    headers.set("svix-timestamp", "1");
    expect(await verifyResendWebhook(raw, headers, secret)).toBe(false);
  });
});
