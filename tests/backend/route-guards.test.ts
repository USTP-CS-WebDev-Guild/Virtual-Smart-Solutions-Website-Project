import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../../backend/app";
import { createDatabase } from "../../backend/lib/database";

vi.mock("../../backend/lib/database", () => ({ createDatabase: vi.fn() }));

function databaseFor(role: "owner" | "staff" = "staff") {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "10000000-0000-4000-8000-000000000001", email_confirmed_at: "2026-01-01T00:00:00Z", email: "member@example.test" } },
        error: null,
      })),
    },
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { email: "member@example.test", role, active: true, auth_user_id: "10000000-0000-4000-8000-000000000001" },
            error: null,
          }),
        }),
      }),
    })),
    rpc: vi.fn(async (name: string) => ({
      data:
        name === "claim_outbox_batch"
          ? []
          : name === "get_dashboard_counts"
            ? { inquiries: { new: 2 }, notifications: { pending: 0, dead: 0 } }
            : {},
      error: null,
    })),
  };
}

const ownerRoutes = [
  ["GET", "/api/admin/submission-checks"],
  ["POST", "/api/admin/test/live-check"],
  ["GET", "/api/admin/privacy-requests"],
  ["PATCH", "/api/admin/privacy-requests/123/complete"],
  ["GET", "/api/admin/site-content"],
  ["GET", "/api/admin/site-content/history"],
  ["PUT", "/api/admin/site-content"],
  ["POST", "/api/admin/test/run-jobs"],
  ["POST", "/api/admin/outbox/retry"],
] as const;

describe("security gates after the route split", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('APP_ORIGIN', 'https://site.example'); });
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["GET", "/api/admin/clients"],
    ["GET", "/api/admin/realtime-status"],
    ["GET", "/api/admin/inquiries/10000000-0000-4000-8000-000000000001/notes"],
    ["POST", "/api/admin/inquiries/10000000-0000-4000-8000-000000000001/notes"],
    ["PATCH", "/api/admin/clients/10000000-0000-4000-8000-000000000001/status"],
  ])("requires staff identity for %s %s", async (method, path) => {
    const db = databaseFor();
    vi.mocked(createDatabase).mockReturnValue(db as any);
    expect(
      (await app(new Request("https://site.example" + path, { method })))
        .status,
    ).toBe(401);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it.each(ownerRoutes)(
    "rejects anonymous %s %s before reaching feature code",
    async (method, path) => {
      const db = databaseFor();
      vi.mocked(createDatabase).mockReturnValue(db as any);
      const response = await app(
        new Request("https://site.example" + path, { method }),
      );
      expect(response.status).toBe(401);
      expect(db.rpc).not.toHaveBeenCalled();
    },
  );

  it.each(ownerRoutes)(
    "blocks staff from owner-only %s %s",
    async (method, path) => {
      const db = databaseFor("staff");
      vi.mocked(createDatabase).mockReturnValue(db as any);
      const response = await app(
        new Request("https://site.example" + path, {
          method,
          headers: { Authorization: "Bearer synthetic-token" },
        }),
      );
      expect(response.status).toBe(403);
      expect(db.rpc).not.toHaveBeenCalled();
    },
  );

  it("allows staff inbox summary access and keeps the documented response shape", async () => {
    vi.mocked(createDatabase).mockReturnValue(databaseFor("staff") as any);
    const response = await app(
      new Request("https://site.example/api/admin/summary", {
        headers: { Authorization: "Bearer synthetic-token" },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      actorRole: "staff",
      inquiries: { new: 2 },
    });
    expect(response.headers.get("X-Request-ID")).toBeTruthy();
  });

  it.each([
    "inquiries/not-a-uuid/status",
    "clients/0000/status",
    "privacy-requests/123/complete",
  ])(
    "rejects malformed resource IDs without issuing database mutations: %s",
    async (path) => {
      const db = databaseFor("owner");
      vi.mocked(createDatabase).mockReturnValue(db as any);
      const response = await app(
        new Request("https://site.example/api/admin/" + path, {
          method: "PATCH",
          headers: {
            Authorization: "Bearer synthetic-token",
            Origin: "https://site.example",
            "X-Requested-With": "VSSDashboard",
          },
        }),
      );
      expect(response.status).toBe(400);
      expect(db.rpc).not.toHaveBeenCalled();
    },
  );

  it("rejects a foreign-origin mutation even for an authenticated owner", async () => {
    const db = databaseFor("owner");
    vi.mocked(createDatabase).mockReturnValue(db as any);
    const response = await app(
      new Request("https://site.example/api/admin/test/run-jobs", {
        method: "POST",
        headers: {
          Authorization: "Bearer synthetic-token",
          Origin: "https://foreign.example",
          "X-Requested-With": "VSSDashboard",
        },
      }),
    );
    expect(response.status).toBe(403);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("runs the shared jobs only after owner and origin checks pass", async () => {
    vi.stubEnv("TEST_EMAIL_MODE", "capture");
    vi.stubEnv("PUBLIC_TEST_ENVIRONMENT", "true");
    const db = databaseFor("owner");
    vi.mocked(createDatabase).mockReturnValue(db as any);
    const response = await app(
      new Request("https://site.example/api/admin/test/run-jobs", {
        method: "POST",
        headers: {
          Authorization: "Bearer synthetic-token",
          Origin: "https://site.example",
          "X-Requested-With": "VSSDashboard",
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      jobs: ["notification_outbox", "privacy_retention"],
    });
    expect(db.rpc).toHaveBeenCalledWith(
      "claim_outbox_batch",
      expect.any(Object),
    );
    expect(db.rpc).toHaveBeenCalledWith(
      "anonymize_expired_data",
      expect.any(Object),
    );
  });
  it.each([
    ['false', 'capture'],
    ['true', 'send'],
  ])('does not expose test jobs outside isolated capture testing (%s, %s)', async (flag, mode) => {
    vi.stubEnv('PUBLIC_TEST_ENVIRONMENT', flag); vi.stubEnv('TEST_EMAIL_MODE', mode);
    const db = databaseFor('owner');
    vi.mocked(createDatabase).mockReturnValue(db as any);
    const response = await app(new Request('https://site.example/api/admin/test/run-jobs', {
      method: 'POST', headers: { Authorization: 'Bearer synthetic-token',
        Origin: 'https://site.example', 'X-Requested-With': 'VSSDashboard' },
    }));
    expect(response.status).toBe(404); expect(db.rpc).not.toHaveBeenCalled();
  });
});
