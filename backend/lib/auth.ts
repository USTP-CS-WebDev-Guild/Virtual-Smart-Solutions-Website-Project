import type { Database } from "./database";
import { json } from "../http/responses";
import { productionMode } from '../security/environment';

export type Actor = { email: string; role: "owner" | "staff" };

export async function staffAuthentication(
  request: Request,
  db: Database,
): Promise<{ actor: Actor | null; eligible: boolean; mfaRequired: boolean; error?: string }> {
  const denied = { actor: null, eligible: false, mfaRequired: false };
  const authorization = request.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match || match[1].length > 8192 || /\s/.test(match[1])) return denied;
  const { data: userData, error: userError } = await db.auth.getUser(match[1]);
  const email = userData.user?.email?.trim().toLowerCase();
  const user = userData.user;
  if (userError || !email || !user?.id || user.is_anonymous ||
      !user.email_confirmed_at) return denied;
  const { data, error } = await db
    .from("staff_users")
    .select("email,role,active,auth_user_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (error || !data || !data.active || data.auth_user_id !== user.id ||
      !["owner", "staff"].includes(data.role)) return denied;
  let enforceSessions = productionMode();
  // Read the database policy in every non-production runtime too. NETLIFY is
  // build metadata, not a reliable Functions runtime flag or an auth boundary.
  if (!enforceSessions) {
    const policy = await db.rpc('get_security_readiness');
    if (policy.error || typeof policy.data?.enforceMfa !== 'boolean')
      throw new Error('staff_security_policy_unavailable');
    enforceSessions = policy.data.enforceMfa;
  }
  const mfaRequired = enforceSessions ||
    Boolean(user.factors?.some((factor) => factor.status === 'verified'));
  // getUser above validates the exact bearer token with Supabase Auth. Only
  // after that validation may its session metadata be read; no role is taken
  // from JWT user_metadata or from an unverified browser claim.
  let claims: Record<string, unknown> = {};
  try { claims = JSON.parse(Buffer.from(match[1].split('.')[1] || '', 'base64url').toString()); }
  catch { /* Opaque local classroom tokens have no JWT claims. */ }
  if (mfaRequired && (claims.aal !== 'aal2' || claims.sub !== user.id))
    return { actor: null, eligible: true, mfaRequired: true, error: 'mfa_required' };
  if (enforceSessions) {
    const sessionId = claims.session_id;
    if (typeof sessionId !== 'string' ||
        !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(sessionId))
      return denied;
    const session = await db.rpc('verify_staff_session', {
      p_user_id: user.id, p_session_id: sessionId, p_aal: claims.aal, p_now: Date.now(),
    });
    if (session.error) throw new Error('staff_session_verification_failed');
    if (session.data?.error === 'security_configuration_required')
      throw new Error('security_configuration_required');
    if (session.data?.ok !== true) return denied;
  }
  return { actor: { email: data.email, role: data.role }, eligible: true, mfaRequired };
}

export async function findActor(request: Request, db: Database): Promise<Actor | null> {
  return (await staffAuthentication(request, db)).actor;
}

export async function requireActor(
  request: Request,
  db: Database,
  ownerOnly = false,
): Promise<Actor | Response> {
  const authentication = await staffAuthentication(request, db);
  if (authentication.error === 'mfa_required')
    return json({ error: 'mfa_required' }, 403);
  const actor = authentication.actor;
  if (!actor) return json({ error: "staff_access_required" }, 401);
  if (ownerOnly && actor.role !== "owner")
    return json({ error: "owner_access_required" }, 403);
  return actor;
}

export function isResponse(value: Actor | Response): value is Response {
  return value instanceof Response;
}
