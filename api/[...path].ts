import { createApp } from '../apps/api/src/app.js';

const app = createApp();

/**
 * Catch-all Vercel function for `/api/*`. The Express application owns the
 * route definitions without that deployment prefix, so remove it before
 * handing the request to the shared Node API.
 */
export default function handler(request: { url?: string } & Record<string, unknown>, response: Record<string, unknown>) {
  if (typeof request.url === 'string' && request.url.startsWith('/api')) {
    request.url = request.url.slice('/api'.length) || '/';
  }
  return (app as unknown as (req: unknown, res: unknown) => unknown)(request, response);
}
