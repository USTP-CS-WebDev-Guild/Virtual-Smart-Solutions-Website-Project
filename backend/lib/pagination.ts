import { json } from '../http/responses';

export const PAGE_SIZE = 50;
export function pageCursor(url: URL): { time: number; id: string } | Response | null {
  const value = url.searchParams.get('cursor');
  if (!value) return null;
  const parts = /^(\d{1,16})_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(
    value,
  );
  if (!parts || !Number.isSafeInteger(Number(parts[1])))
    return json({ error: 'invalid_cursor' }, 422);
  return { time: Number(parts[1]), id: parts[2]! };
}
export function beforeCursor(cursor: { time: number; id: string }) {
  // Both fields have been validated; arbitrary PostgREST expressions are never accepted.
  return `created_at.lt.${cursor.time},and(created_at.eq.${cursor.time},id.lt.${cursor.id})`;
}
export function nextCursor(rows: Array<{ id: string; created_at: number | string }>) {
  const last = rows[PAGE_SIZE - 1];
  return rows.length > PAGE_SIZE && last ? `${last.created_at}_${last.id}` : null;
}
