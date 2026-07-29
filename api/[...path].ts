type ExpressHandler = (request: unknown, response: unknown) => unknown;

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
export default async function handler(request: { url?: string } & Record<string, unknown>, response: Record<string, unknown>) {
  if (typeof request.url === 'string' && request.url.startsWith('/api')) {
    request.url = request.url.slice('/api'.length) || '/';
  }
  return (await getApp())(request, response);
}
