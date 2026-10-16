import { createDatabase, type Database } from "./lib/database";
import { isResponse, requireActor } from "./lib/auth";
import { csrfOkay, json } from "./http/responses";
import type { RouteContext, StaffRouteContext } from "./http/context";
import {
  systemRoutes,
  submissionChecks,
  realtimeStatus,
} from "./routes/system";
import { publicRoutes } from "./routes/public";
import { emailWebhookRoutes } from "./routes/email-webhook";
import { inquiryRoutes } from "./routes/inquiries";
import { privacyRoutes } from "./routes/privacy";
import { contentRoutes } from "./routes/content";
import { notificationRoutes } from "./routes/notifications";
import { clientRoutes } from "./routes/clients";

export type AppContext = { ip?: string };

async function dispatch(route: RouteContext): Promise<Response> {
  // Public routes run their own validation, rate limit, or webhook signature check.
  const system = await systemRoutes(route);
  if (system) return system;
  const publicPage = await publicRoutes(route);
  if (publicPage) return publicPage;
  const webhook = await emailWebhookRoutes(route);
  if (webhook) return webhook;

  if (!route.path.startsWith("/api/admin/"))
    return json({ error: "not_found" }, 404);

  // This is the one shared security gate for every owner/staff endpoint.
  const db = route.database();
  const ownerOnly =
    route.path.startsWith("/api/admin/privacy-requests") ||
    route.path.startsWith("/api/admin/site-content") ||
    route.path.startsWith("/api/admin/test/") ||
    route.path === "/api/admin/submission-checks" ||
    route.path === "/api/admin/outbox/retry";
  const actor = await requireActor(route.request, db, ownerOnly);
  if (isResponse(actor)) return actor;
  const resource = route.path.match(
    /^\/api\/admin\/(?:inquiries|clients|privacy-requests)\/([^/]+)/,
  );
  if (
    resource &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      resource[1],
    )
  )
    return json({ error: "invalid_identifier" }, 400);
  if (route.method !== "GET" && !csrfOkay(route.request)) {
    return json({ error: "csrf_check_failed" }, 403);
  }

  const staffRoute: StaffRouteContext = { ...route, db, actor };
  const setup = await submissionChecks(staffRoute);
  if (setup) return setup;
  const realtime = await realtimeStatus(staffRoute);
  if (realtime) return realtime;
  const inquiries = await inquiryRoutes(staffRoute);
  if (inquiries) return inquiries;
  const clients = await clientRoutes(staffRoute);
  if (clients) return clients;
  const privacy = await privacyRoutes(staffRoute);
  if (privacy) return privacy;
  const content = await contentRoutes(staffRoute);
  if (content) return content;
  const notifications = await notificationRoutes(staffRoute);
  if (notifications) return notifications;
  return json({ error: "not_found" }, 404);
}

// The local server and Netlify both call this exact application function.
export function createApplication(database: () => Database = createDatabase) {
  return async function app(
    request: Request,
    context: AppContext = {},
  ): Promise<Response> {
    const requestId = crypto.randomUUID();
    try {
      const url = new URL(request.url);
      const response = await dispatch({
        request,
        url,
        requestId,
        path: url.pathname.replace(/\/+$/, "") || "/",
        method: request.method.toUpperCase(),
        ip: context.ip || "",
        database,
      });
      response.headers.set("X-Request-ID", requestId);
      return response;
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "request_failed",
          requestId,
          // Provider exceptions can contain personal data. Log a safe class only.
          errorType:
            error instanceof TypeError ? "type_error" : "application_error",
          failureCode:
            error instanceof Error &&
            ["rate_limit_not_configured", "database_not_configured"].includes(
              error.message,
            )
              ? error.message
              : "request_failed",
        }),
      );
      return json(
        {
          error: "service_unavailable",
          message: "We could not complete that request. Please try again.",
          requestId,
        },
        503,
        requestId,
      );
    }
  };
}

export default createApplication();
