import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { createTestDatabase } from "../helpers/database";
import { DEFAULT_SITE_CONTENT } from "../../shared/site-content/defaults";

describe("server role and database defense in depth", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await createTestDatabase();
  }, 30_000);
  afterAll(async () => {
    await db?.close();
  });
  const payload = () => ({
    idempotencyKey: crypto.randomUUID(),
    name: "Synthetic Contact",
    email: "synthetic@example.test",
    company: "",
    phone: "",
    service: "Virtual Assistant",
    message: "Synthetic support inquiry.",
    privacyNoticeVersion: "test-v1",
  });
  it("runs the real transactional workflow as service_role, without database-owner privileges", async () => {
    await db.exec("set role service_role");
    try {
      const first = await db.query<any>(
        "select public.submit_inquiry($1::jsonb,1000) as result",
        [JSON.stringify(payload())],
      );
      const id = first.rows[0].result.inquiryId;
      await db.query(
        "select public.change_inquiry_status($1::uuid,'in_progress','owner@example.test',1001)",
        [id],
      );
      const converted = await db.query<any>(
        "select public.convert_inquiry($1::uuid,'owner@example.test',1002) as result",
        [id],
      );
      expect(converted.rows[0].result.client.source_inquiry_id).toBe(id);
      const published = await db.query<any>(
        "select public.publish_site_content(0,$1::jsonb,'owner@example.test',1003) as result",
        [JSON.stringify(DEFAULT_SITE_CONTENT)],
      );
      expect(published.rows[0].result.revision).toBe(1);
      const notices = await db.query(
        "select * from public.claim_outbox_batch(1004,5)",
      );
      expect(notices.rows).toHaveLength(1);
      expect(
        (await db.query<any>("select public.get_dashboard_counts() as result"))
          .rows[0].result.inquiries.converted,
      ).toBe(1);
    } finally {
      await db.exec("reset role");
    }
  });
  it("uses invoker privileges for every public application RPC and prevents browser schema creation", async () => {
    const result = await db.query<any>(
      "select proname from pg_proc where pronamespace='public'::regnamespace and prosecdef",
    );
    expect(result.rows).toEqual([]);
    for (const role of ["anon", "authenticated"]) {
      const result = await db.query<any>(
        "select has_schema_privilege($1,'public','CREATE') as allowed",
        [role],
      );
      expect(result.rows[0].allowed).toBe(false);
    }
  });
  it("rejects oversize fields inside SQL and rolls back inquiry, audit and outbox together", async () => {
    const before = await db.query(
      "select (select count(*)::int from inquiries) as inquiries,(select count(*)::int from inquiry_events) as events,(select count(*)::int from outbox) as notices",
    );
    await expect(
      db.query("select public.submit_inquiry($1::jsonb,2000)", [
        JSON.stringify({ ...payload(), message: "x".repeat(5001) }),
      ]),
    ).rejects.toThrow(/inquiries_field_bounds/);
    const after = await db.query(
      "select (select count(*)::int from inquiries) as inquiries,(select count(*)::int from inquiry_events) as events,(select count(*)::int from outbox) as notices",
    );
    expect(after.rows).toEqual(before.rows);
  });
  it("saturates abusive counters and rejects nonsensical rate-limit parameters", async () => {
    for (let i = 0; i < 20; i++)
      await db.query(
        "select public.consume_rate_limit('synthetic-bucket',0,100,5)",
      );
    expect(
      (
        await db.query<any>(
          "select hit_count from rate_limit_buckets where bucket_key='synthetic-bucket'",
        )
      ).rows[0].hit_count,
    ).toBe(6);
    await expect(
      db.query("select public.consume_rate_limit('synthetic',0,100,0)"),
    ).rejects.toThrow(/invalid_rate_limit_parameters/);
  });
  it("dead-letters an expired eighth lease instead of sending a ninth attempt", async () => {
    await db.exec(
      "update public.outbox set status='sending',attempts=8,locked_until=5000",
    );
    expect(
      (await db.query("select * from public.claim_outbox_batch(5001,5)")).rows,
    ).toHaveLength(0);
    expect(
      (await db.query<any>("select status,attempts,last_error from outbox"))
        .rows[0],
    ).toEqual({
      status: "dead",
      attempts: 8,
      last_error: "retry_limit_reached",
    });
  });
});
