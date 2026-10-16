import { json } from '../http/responses';

export function searchTerm(url: URL): string | Response {
  const term = (url.searchParams.get('q') || '').trim();
  if (term.length > 100 || /[\u0000-\u001f\u007f]/.test(term))
    return json({ error: 'invalid_search', message: 'Use a search of up to 100 characters.' }, 422);
  return term;
}
export function searchFilter(term: string, columns: readonly string[]): string {
  // Search a literal, case-insensitive substring. Escape every regex operator
  // before using PostgreSQL imatch; *, %, and _ remain customer text rather
  // than PostgREST/LIKE wildcards. Quoting also protects filter punctuation.
  const pattern = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const quoted = JSON.stringify(pattern);
  return columns
    .map((column) => {
      if (!/^[a-z_]+$/.test(column)) throw new Error('invalid_search_column');
      return column + '.imatch.' + quoted;
    })
    .join(',');
}
