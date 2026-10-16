import type { Database } from '../lib/database';
import type { Actor } from '../lib/auth';

// One request's details, shared by the small feature route files.
export type RouteContext = {
  request: Request;
  url: URL;
  path: string;
  method: string;
  requestId: string;
  ip: string;
  database: () => Database;
};

// Only app.ts creates this after checking the staff token and role.
export type StaffRouteContext = RouteContext & { db: Database; actor: Actor };
