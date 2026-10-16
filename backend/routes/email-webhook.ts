import { json } from "../http/responses";
import { readBodyText } from "../http/body";
import { verifyResendWebhook } from "../security/email-signature";
import type { RouteContext } from "../http/context";

export async function emailWebhookRoutes(
  route: RouteContext,
): Promise<Response | null> {
  const { request, path, method, requestId } = route;
  if (method === "POST" && path === "/api/webhooks/resend") {
    const body = await readBodyText(request, 64_000);
    if (!body.ok)
      return json(
        { error: body.status === 413 ? "request_too_large" : "invalid_event" },
        body.status,
        requestId,
      );
    const rawBody = body.text;
    if (
      !(await verifyResendWebhook(
        rawBody,
        request.headers,
        process.env.RESEND_WEBHOOK_SECRET,
      ))
    ) {
      return json({ error: "invalid_signature" }, 401, requestId);
    }
    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return json({ error: "invalid_event" }, 400, requestId);
    }
    const eventId = request.headers.get("svix-id");
    const emailId = event?.data?.email_id;
    if (
      !eventId ||
      typeof emailId !== "string" ||
      emailId.length > 200 ||
      !emailId ||
      typeof event?.type !== "string" ||
      event.type.length > 80
    )
      return json({ error: "invalid_event" }, 400, requestId);
    const delivery = new Map<string, string>([
      ["email.delivered", "delivered"],
      ["email.bounced", "bounced"],
      ["email.complained", "complained"],
      ["email.failed", "failed"],
      ["email.delivery_delayed", "delayed"],
    ]).get(event.type);
    if (!delivery) return json({ received: true }, 200, requestId);
    const db = route.database();
    const { error } = await db.rpc("apply_delivery_event", {
      p_event_id: eventId,
      p_event_type: event.type,
      p_provider_message_id: emailId,
      p_delivery_status: delivery,
      p_now: Date.now(),
    });
    if (error) throw new Error("webhook_event_store_failed");
    return json({ received: true }, 200, requestId);
  }
  return null;
}
