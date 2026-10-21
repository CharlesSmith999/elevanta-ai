export type LoadOptions = { signal?: AbortSignal; onProgress?: (loaded: number) => void };
export type CursorPage<T> = { rows: T[]; nextCursor: string | null };

/** A deadline covers both response headers and body, and is cleared on every exit. */
export async function boundedRead<T>(read: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal, timeoutMs = 25_000): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    if (controller.signal.aborted) throw new Error('Workspace loading cancelled.');
    const aborted = new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error(
        timedOut ? 'CRM loading timed out. Retry the connection.' : 'Workspace loading cancelled.',
      )), { once: true }));
    return await Promise.race([read(controller.signal), aborted]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

/** Never publish an incomplete collection as a successful workspace snapshot. */
export async function loadAllPages<T extends { id: string }>(
  readPage: (after: string | undefined, signal: AbortSignal) => Promise<CursorPage<T>>,
  options: LoadOptions = {},
): Promise<T[]> {
  const rows = new Map<string, T>();
  const cursors = new Set<string>();
  let after: string | undefined;
  for (;;) {
    const page = await boundedRead((signal) => readPage(after, signal), options.signal);
    for (const row of page.rows) rows.set(row.id, row);
    options.onProgress?.(rows.size);
    if (page.nextCursor === null) return [...rows.values()];
    if (!page.rows.length || !page.nextCursor || cursors.has(page.nextCursor)) {
      throw new Error('CRM pagination did not advance. Retry the connection.');
    }
    cursors.add(page.nextCursor);
    after = page.nextCursor;
  }
}
