type Handler = (request: unknown, response: unknown) => unknown;
let appPromise: Promise<Handler> | undefined;

export default async function handler(request: { url?: string; originalUrl?: string }, response: unknown) {
  const { normalizeCrmPath } = await import('../apps/api/src/routing.js');
  request.url = normalizeCrmPath(request.url ?? request.originalUrl ?? '/api');
  appPromise ??= import('../apps/api/src/app.js').then(({ createApp }) => createApp() as unknown as Handler);
  return (await appPromise)(request, response);
}
