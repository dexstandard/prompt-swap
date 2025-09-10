const store = new Map<string, { value: unknown; expires: number }>();
const locks = new Set<string>();
const DEFAULT_TTL = 3 * 60 * 1000; // 3 minutes

export async function setCache(
  key: string,
  value: unknown,
  ttlMs = DEFAULT_TTL,
): Promise<void> {
  store.set(key, { value, expires: Date.now() + ttlMs });
}

export async function getCache<T>(key: string): Promise<T | null> {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function acquireLock(key: string): boolean {
  if (locks.has(key)) return false;
  locks.add(key);
  return true;
}

export function releaseLock(key: string): void {
  locks.delete(key);
}

export function clearCache() {
  store.clear();
  locks.clear();
}
