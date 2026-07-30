type ExpressHandler = (request: unknown, response: unknown) => unknown;

type VercelRequest = { url?: string; originalUrl?: string } & Record<string, unknown>;

/**
 * Vercel's root catch-all serves one-segment API paths such as /api/health,
 * but production CRM traffic lives below /api/v1. Keep a concrete v1
 * catch-all so requests such as /api/v1/opportunities always invoke the
 * shared Express CRM API.
 */
function normalizeApiPath(request: VercelRequest) {
  const rawUrl = typeof request.url === 'string' && request.url
    ? request.url
    : typeof request.originalUrl === 'string' ? request.originalUrl : '/api';

  let path = rawUrl;
  try {
    const parsed = new URL(rawUrl, 'https://elevanta.internal');
    path = `${parsed.pathname}${parsed.search}`;
  } catch {
    // Let Express return its normal route error if the platform URL is malformed.
  }

  request.url = (path === '/api' || path.startsWith('/api/'))
    ? path.slice('/api'.length) || '/'
    : path || '/';
}

let appPromise: Promise<ExpressHandler> | undefined;

function getApp() {
  appPromise ??= import('../../apps/api/src/app.js').then(({ createApp }) => createApp() as unknown as ExpressHandler);
  return appPromise;
}

export default async function handler(request: VercelRequest, response: Record<string, unknown>) {
  normalizeApiPath(request);
  return (await getApp())(request, response);
}
