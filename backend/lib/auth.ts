import type { Database } from "./database";
import { json } from "../http/responses";

export type Actor = { email: string; role: "owner" | "staff" };

export async function findActor(
  request: Request,
  db: Database,
): Promise<Actor | null> {
  const authorization = request.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match || match[1].length > 8192 || /\s/.test(match[1])) return null;
  const { data: userData, error: userError } = await db.auth.getUser(match[1]);
  const email = userData.user?.email?.trim().toLowerCase();
  if (userError || !email) return null;
  const { data, error } = await db
    .from("staff_users")
    .select("email,role,active")
    .eq("email", email)
    .maybeSingle();
  if (error || !data || !data.active || !["owner", "staff"].includes(data.role))
    return null;
  return { email, role: data.role };
}

export async function requireActor(
  request: Request,
  db: Database,
  ownerOnly = false,
): Promise<Actor | Response> {
  const actor = await findActor(request, db);
  if (!actor) return json({ error: "staff_access_required" }, 401);
  if (ownerOnly && actor.role !== "owner")
    return json({ error: "owner_access_required" }, 403);
  return actor;
}

export function isResponse(value: Actor | Response): value is Response {
  return value instanceof Response;
}
