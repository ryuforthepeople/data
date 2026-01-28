import { Hono } from 'hono';
import type { DataAdapter } from '@for-the-people/data-core';
import { createCorsMiddleware } from './middleware/cors.js';
import { rateLimiter } from './middleware/ratelimit.js';
import { resourceRoutes } from './routes/resources.js';

export interface AppConfig {
  adapter: DataAdapter;
  corsOrigins?: string[];
  rateLimit?: number;
  rateLimitWindowMs?: number;
  cacheTtlMs?: number;
  allowedTables?: string[];
}

export function createApp(config: AppConfig): Hono {
  const app = new Hono();

  // Global middleware
  app.use('*', createCorsMiddleware(config.corsOrigins ?? ['*']));
  app.use('/api/*', rateLimiter(config.rateLimit ?? 60, config.rateLimitWindowMs ?? 60_000));

  // Routes
  app.route('/api/v1', resourceRoutes(config.adapter, {
    cacheTtlMs: config.cacheTtlMs,
    allowedTables: config.allowedTables,
  }));

  return app;
}

export { createCorsMiddleware } from './middleware/cors.js';
export { rateLimiter } from './middleware/ratelimit.js';
export { resourceRoutes } from './routes/resources.js';
