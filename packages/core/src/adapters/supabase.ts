import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { DataAdapter } from './adapter.js';
import type {
  QueryFilter,
  QueryOptions,
  PaginatedResult,
  DataRecord,
  SupabaseAdapterConfig,
} from '../types/index.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any;

function applyFilter(query: AnyQuery, f: QueryFilter): AnyQuery {
  switch (f.operator) {
    case 'eq': return query.eq(f.field, f.value);
    case 'neq': return query.neq(f.field, f.value);
    case 'gt': return query.gt(f.field, f.value);
    case 'gte': return query.gte(f.field, f.value);
    case 'lt': return query.lt(f.field, f.value);
    case 'lte': return query.lte(f.field, f.value);
    case 'like': return query.like(f.field, f.value);
    case 'ilike': return query.ilike(f.field, f.value);
    case 'in': return query.in(f.field, f.value as unknown[]);
    case 'is': return query.is(f.field, f.value);
    default: return query;
  }
}

function applyFilters(query: AnyQuery, filters: QueryFilter[]): AnyQuery {
  let q = query;
  for (const f of filters) {
    q = applyFilter(q, f);
  }
  return q;
}

export class SupabaseAdapter implements DataAdapter {
  readonly provider = 'supabase' as const;
  private client: SupabaseClient;

  constructor(config: SupabaseAdapterConfig) {
    this.client = createClient(config.url, config.serviceRoleKey ?? config.anonKey);
  }

  async findMany<T extends DataRecord>(
    table: string,
    options?: QueryOptions
  ): Promise<PaginatedResult<T>> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    const selectCols = options?.select?.join(', ') ?? '*';

    let query: AnyQuery = this.client.from(table).select(selectCols, { count: 'exact' });

    if (options?.filters) {
      query = applyFilters(query, options.filters);
    }

    if (options?.orderBy) {
      for (const o of options.orderBy) {
        query = query.order(o.field, { ascending: o.direction === 'asc' });
      }
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(`Supabase findMany error: ${error.message}`);

    const totalCount = (count as number | null) ?? 0;
    const rows = (data ?? []) as unknown as T[];

    return {
      data: rows,
      count: totalCount,
      limit,
      offset,
      hasMore: offset + rows.length < totalCount,
    };
  }

  async findOne<T extends DataRecord>(
    table: string,
    id: string
  ): Promise<T | null> {
    const { data, error } = await this.client
      .from(table)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Supabase findOne error: ${error.message}`);
    return (data as unknown as T) ?? null;
  }

  async create<T extends DataRecord>(
    table: string,
    data: Omit<T, 'id' | 'created_at' | 'updated_at'>
  ): Promise<T> {
    const { data: row, error } = await this.client
      .from(table)
      .insert(data as Record<string, unknown>)
      .select()
      .single();

    if (error) throw new Error(`Supabase create error: ${error.message}`);
    return row as unknown as T;
  }

  async createMany<T extends DataRecord>(
    table: string,
    data: Omit<T, 'id' | 'created_at' | 'updated_at'>[]
  ): Promise<T[]> {
    const { data: rows, error } = await this.client
      .from(table)
      .insert(data as Record<string, unknown>[])
      .select();

    if (error) throw new Error(`Supabase createMany error: ${error.message}`);
    return (rows ?? []) as unknown as T[];
  }

  async update<T extends DataRecord>(
    table: string,
    id: string,
    data: Partial<Omit<T, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<T> {
    const { data: row, error } = await this.client
      .from(table)
      .update(data as Record<string, unknown>)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Supabase update error: ${error.message}`);
    return row as unknown as T;
  }

  async delete(table: string, id: string): Promise<void> {
    const { error } = await this.client
      .from(table)
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Supabase delete error: ${error.message}`);
  }

  async deleteMany(table: string, filters: QueryFilter[]): Promise<number> {
    let query: AnyQuery = this.client.from(table).delete({ count: 'exact' });
    query = applyFilters(query, filters);

    const { count, error } = await query;
    if (error) throw new Error(`Supabase deleteMany error: ${error.message}`);
    return (count as number | null) ?? 0;
  }

  async count(table: string, filters?: QueryFilter[]): Promise<number> {
    let query: AnyQuery = this.client.from(table).select('*', { count: 'exact', head: true });

    if (filters) {
      query = applyFilters(query, filters);
    }

    const { count, error } = await query;
    if (error) throw new Error(`Supabase count error: ${error.message}`);
    return (count as number | null) ?? 0;
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      await this.client.from('_health').select('*').limit(1);
      return { ok: true, latencyMs: Date.now() - start };
    } catch {
      return { ok: true, latencyMs: Date.now() - start };
    }
  }
}
