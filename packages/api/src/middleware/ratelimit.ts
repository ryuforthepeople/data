import type { MiddlewareHandler } from 'hono';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 300_000);
if (typeof cleanup === 'object' && cleanup !== null && 'unref' in (cleanup as object)) {
  (cleanup as { unref: () => void }).unref();
}

export function rateLimiter(maxRequests = 60, windowMs = 60_000): MiddlewareHandler {
  return async (c, next) => {
    const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown';
    const now = Date.now();
    const entry = store.get(ip);

    if (!entry || entry.resetAt < now) {
      store.set(ip, { count: 1, resetAt: now + windowMs });
      await next();
      return;
    }

    entry.count++;
    if (entry.count > maxRequests) {
      return c.json({ error: 'Too many requests' }, 429);
    }

    await next();
  };
}
