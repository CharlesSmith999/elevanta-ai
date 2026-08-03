type ExpressHandler = (request: unknown, response: unknown) => unknown;

type VercelRequest = { url?: string; originalUrl?: string } & Record<string, unknown>;

/**
 * Vercel can provide either a path (`/api/v1/...`) or an absolute URL to a
 * serverless function. Express expects the path without the `/api` function
 * mount, so normalize both forms before handing the request to the app.
 */
function normalizeApiPath(request: VercelRequest) {
  const rawUrl = typeof request.url === 'string' && request.url
    ? request.url
    : typeof request.originalUrl === 'string' ? request.originalUrl : '/api';

  let path = rawUrl;
  try {
    // The base is only used for relative URLs; an absolute Vercel URL is
    // parsed without changing its pathname or query string.
    const parsed = new URL(rawUrl, 'https://elevanta.internal');
    path = `${parsed.pathname}${parsed.search}`;
  } catch {
    // Keep the original value so Express can still produce its normal error.
  }

  if (path === '/api' || path.startsWith('/api/')) {
    request.url = path.slice('/api'.length) || '/';
  } else {
    request.url = path || '/';
  }
}

// Vercel transpiles this entrypoint as CommonJS while the shared API is ESM.
// Dynamic import keeps the Vercel wrapper compatible without duplicating routes.
let appPromise: Promise<ExpressHandler> | undefined;

function getApp() {
  appPromise ??= import('../apps/api/src/app.js').then(({ createApp }) => createApp() as unknown as ExpressHandler);
  return appPromise;
}

/**
 * Catch-all Vercel function for `/api/*`. The Express application owns the
 * route definitions without that deployment prefix, so remove it before
 * handing the request to the shared Node API.
 */
export default async function handler(request: VercelRequest, response: Record<string, unknown>) {
  normalizeApiPath(request);
  return (await getApp())(request, response);
}
