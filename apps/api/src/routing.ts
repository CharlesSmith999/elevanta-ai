/** Preserve nested API paths and filters whether Vercel supplies the original or rewritten URL. */
export function normalizeCrmPath(rawUrl: string) {
  const parsed = new URL(rawUrl, 'https://elevanta.internal');
  const rewritten = parsed.searchParams.get('__crm_path');
  parsed.searchParams.delete('__crm_path');
  // Vercel's catch-all function adapter may also expose its routing key as
  // `path` in the query string. It is transport metadata, not an API filter.
  parsed.searchParams.delete('path');
  const path = (parsed.pathname === '/api' || parsed.pathname === '/api/') && rewritten
    ? `/${rewritten.replace(/^\/+/, '')}`
    : parsed.pathname.replace(/^\/api(?=\/|$)/, '') || '/';
  const query = parsed.searchParams.toString();
  return path + (query ? `?${query}` : '');
}
