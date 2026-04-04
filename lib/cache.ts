import 'server-only'

const cache = new Map<string, { data: any; ts: number }>()
const TTL = 60_000 // 60 seconds

export async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.ts < TTL) {
    return entry.data as T
  }
  const data = await fn()
  cache.set(key, { data, ts: Date.now() })
  return data
}

export function invalidateCache(prefix?: string) {
  if (!prefix) { cache.clear(); return }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}
