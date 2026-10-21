type Entry = { value?: unknown; expires: number; pending?: Promise<unknown>; controller?: AbortController };
const entries = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();
const maxEntries = 120;

export function queryValue<T>(key: string): T | undefined { return entries.get(key)?.value as T | undefined; }
export function subscribeQuery(key: string, listener: () => void) {
  const subscribers = listeners.get(key) ?? new Set(); subscribers.add(listener); listeners.set(key, subscribers);
  return () => { subscribers.delete(listener); if (!subscribers.size) listeners.delete(key); };
}
export async function cachedQuery<T>(key: string, load: (signal: AbortSignal) => Promise<T>, ttl = 60_000): Promise<T> {
  const existing = entries.get(key);
  if (existing?.value !== undefined && existing.expires > Date.now()) return existing.value as T;
  if (existing?.pending) return existing.pending as Promise<T>;
  const controller = new AbortController();
  const entry: Entry = { value: existing?.value, expires: 0, controller };
  const timeout = setTimeout(() => controller.abort(), 25_000);
  entry.pending = load(controller.signal).then(value => {
    if (entries.get(key) === entry) { entry.value = value; entry.expires = Date.now() + ttl; }
    return value;
  }).finally(() => { clearTimeout(timeout); entry.pending = undefined; entry.controller = undefined; });
  entries.set(key, entry);
  if (entries.size > maxEntries) for (const [oldKey, oldEntry] of entries) {
    if (oldKey !== key && !listeners.has(oldKey) && !oldEntry.pending) { entries.delete(oldKey); break; }
  }
  return entry.pending as Promise<T>;
}
export function invalidateQueries(predicate: (key: string) => boolean = key => !key.includes('"directory"')) {
  for (const [key, entry] of entries) if (predicate(key)) { entry.controller?.abort(); entries.delete(key); }
  for (const [key, subscribers] of listeners) if (predicate(key)) for (const notify of subscribers) notify();
}
export function clearQueryCache() { invalidateQueries(() => true); }
