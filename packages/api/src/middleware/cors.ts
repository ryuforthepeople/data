import { cors } from 'hono/cors';
import type { MiddlewareHandler } from 'hono';

export function createCorsMiddleware(origins: string[]): MiddlewareHandler {
  return cors({
    origin: origins,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  });
}
