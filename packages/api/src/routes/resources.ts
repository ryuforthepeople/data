import { Hono } from 'hono';
import type { DataAdapter, QueryFilter, QueryOptions } from '@for-the-people/data-core';
import { DataService } from '@for-the-people/data-core';

function parseFilters(raw: string | string[] | undefined): QueryFilter[] {
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : [raw];
  return items.map((s) => {
    const parts = s.split(':');
    if (parts.length < 3) throw new Error(`Invalid filter format: ${s} (expected field:op:value)`);
    const field = parts[0]!;
    const operator = parts[1]! as QueryFilter['operator'];
    const value = parts.slice(2).join(':');
    // Try to parse as JSON for arrays/numbers/booleans/null
    try {
      return { field, operator, value: JSON.parse(value) };
    } catch {
      return { field, operator, value };
    }
  });
}

function parseOrderBy(raw: string | string[] | undefined): QueryOptions['orderBy'] {
  if (!raw) return undefined;
  const items = Array.isArray(raw) ? raw : [raw];
  return items.map((s) => {
    const [field, dir] = s.split(':');
    return { field: field!, direction: (dir === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc' };
  });
}

export function resourceRoutes(adapter: DataAdapter, config?: { cacheTtlMs?: number; allowedTables?: string[] }): Hono {
  const app = new Hono();
  const service = new DataService(adapter, config);

  // Health check
  app.get('/health', async (c) => {
    const result = await service.healthCheck();
    return c.json(result, result.ok ? 200 : 503);
  });

  // GET /:table/count
  app.get('/:table/count', async (c) => {
    try {
      const table = c.req.param('table');
      const filters = parseFilters(c.req.queries('filter') ?? c.req.query('filter'));
      const count = await service.count(table, filters.length ? filters : undefined);
      return c.json({ count });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 400);
    }
  });

  // GET /:table — findMany
  app.get('/:table', async (c) => {
    try {
      const table = c.req.param('table');
      const filters = parseFilters(c.req.queries('filter') ?? c.req.query('filter'));
      const orderBy = parseOrderBy(c.req.queries('orderBy') ?? c.req.query('orderBy'));
      const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!, 10) : undefined;
      const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!, 10) : undefined;
      const select = c.req.query('select')?.split(',');

      const options: QueryOptions = {};
      if (filters.length) options.filters = filters;
      if (orderBy) options.orderBy = orderBy;
      if (limit !== undefined) options.limit = limit;
      if (offset !== undefined) options.offset = offset;
      if (select) options.select = select;

      const result = await service.findMany(table, options);
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 400);
    }
  });

  // GET /:table/:id — findOne
  app.get('/:table/:id', async (c) => {
    try {
      const table = c.req.param('table');
      const id = c.req.param('id');
      const result = await service.findOne(table, id);
      if (!result) return c.json({ error: 'Not found' }, 404);
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 400);
    }
  });

  // POST /:table/batch — createMany
  app.post('/:table/batch', async (c) => {
    try {
      const table = c.req.param('table');
      const body = await c.req.json();
      if (!Array.isArray(body)) return c.json({ error: 'Body must be an array' }, 400);
      const result = await service.createMany(table, body);
      return c.json(result, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 400);
    }
  });

  // POST /:table — create
  app.post('/:table', async (c) => {
    try {
      const table = c.req.param('table');
      const body = await c.req.json();
      const result = await service.create(table, body);
      return c.json(result, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 400);
    }
  });

  // PUT /:table/:id — update
  app.put('/:table/:id', async (c) => {
    try {
      const table = c.req.param('table');
      const id = c.req.param('id');
      const body = await c.req.json();
      const result = await service.update(table, id, body);
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 400);
    }
  });

  // DELETE /:table/:id — delete
  app.delete('/:table/:id', async (c) => {
    try {
      const table = c.req.param('table');
      const id = c.req.param('id');
      await service.delete(table, id);
      return c.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 400);
    }
  });

  return app;
}
