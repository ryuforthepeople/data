import type { DataAdapter } from '../adapters/adapter.js';
import type {
  QueryOptions,
  QueryFilter,
  PaginatedResult,
  DataRecord,
} from '../types/index.js';
import { DataError } from '../types/index.js';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

interface DataServiceConfig {
  cacheTtlMs?: number;
  allowedTables?: string[];
}

const TABLE_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/;
const ID_RE = /^[a-zA-Z0-9_-]{1,255}$/;

export class DataService {
  private adapter: DataAdapter;
  private cache = new Map<string, CacheEntry<unknown>>();
  private cacheTtlMs: number;
  private allowedTables?: string[];

  constructor(adapter: DataAdapter, config?: DataServiceConfig) {
    this.adapter = adapter;
    this.cacheTtlMs = config?.cacheTtlMs ?? 0;
    this.allowedTables = config?.allowedTables;
  }

  private validateTable(table: string): void {
    if (!TABLE_NAME_RE.test(table)) {
      throw this.error(`Invalid table name: ${table}`, 'VALIDATION');
    }
    if (this.allowedTables && !this.allowedTables.includes(table)) {
      throw this.error(`Table not allowed: ${table}`, 'VALIDATION');
    }
  }

  private validateId(id: string): void {
    if (!ID_RE.test(id)) {
      throw this.error(`Invalid id: ${id}`, 'VALIDATION');
    }
  }

  private error(message: string, code: DataError['code']): DataError {
    return new DataError(message, code);
  }

  private cacheKey(table: string, id?: string): string {
    return id ? `${table}:${id}` : table;
  }

  private getCached<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.data as T;
  }

  private setCache<T>(key: string, data: T): void {
    if (this.cacheTtlMs > 0) {
      this.cache.set(key, { data, expiresAt: Date.now() + this.cacheTtlMs });
    }
  }

  private invalidateTable(table: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${table}:`)) {
        this.cache.delete(key);
      }
    }
  }

  async findMany<T extends DataRecord>(
    table: string,
    options?: QueryOptions
  ): Promise<PaginatedResult<T>> {
    this.validateTable(table);
    try {
      return await this.adapter.findMany<T>(table, options);
    } catch (err) {
      throw this.error(
        err instanceof Error ? err.message : 'findMany failed',
        'ADAPTER'
      );
    }
  }

  async findOne<T extends DataRecord>(
    table: string,
    id: string
  ): Promise<T | null> {
    this.validateTable(table);
    this.validateId(id);

    const key = this.cacheKey(table, id);
    const cached = this.getCached<T>(key);
    if (cached) return cached;

    try {
      const result = await this.adapter.findOne<T>(table, id);
      if (result) this.setCache(key, result);
      return result;
    } catch (err) {
      throw this.error(
        err instanceof Error ? err.message : 'findOne failed',
        'ADAPTER'
      );
    }
  }

  async create<T extends DataRecord>(
    table: string,
    data: Omit<T, 'id' | 'created_at' | 'updated_at'>
  ): Promise<T> {
    this.validateTable(table);
    try {
      const result = await this.adapter.create<T>(table, data);
      this.invalidateTable(table);
      return result;
    } catch (err) {
      throw this.error(
        err instanceof Error ? err.message : 'create failed',
        'ADAPTER'
      );
    }
  }

  async createMany<T extends DataRecord>(
    table: string,
    data: Omit<T, 'id' | 'created_at' | 'updated_at'>[]
  ): Promise<T[]> {
    this.validateTable(table);
    try {
      const result = await this.adapter.createMany<T>(table, data);
      this.invalidateTable(table);
      return result;
    } catch (err) {
      throw this.error(
        err instanceof Error ? err.message : 'createMany failed',
        'ADAPTER'
      );
    }
  }

  async update<T extends DataRecord>(
    table: string,
    id: string,
    data: Partial<Omit<T, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<T> {
    this.validateTable(table);
    this.validateId(id);
    try {
      const result = await this.adapter.update<T>(table, id, data);
      this.cache.delete(this.cacheKey(table, id));
      return result;
    } catch (err) {
      throw this.error(
        err instanceof Error ? err.message : 'update failed',
        'ADAPTER'
      );
    }
  }

  async delete(table: string, id: string): Promise<void> {
    this.validateTable(table);
    this.validateId(id);
    try {
      await this.adapter.delete(table, id);
      this.cache.delete(this.cacheKey(table, id));
    } catch (err) {
      throw this.error(
        err instanceof Error ? err.message : 'delete failed',
        'ADAPTER'
      );
    }
  }

  async deleteMany(table: string, filters: QueryFilter[]): Promise<number> {
    this.validateTable(table);
    try {
      const count = await this.adapter.deleteMany(table, filters);
      this.invalidateTable(table);
      return count;
    } catch (err) {
      throw this.error(
        err instanceof Error ? err.message : 'deleteMany failed',
        'ADAPTER'
      );
    }
  }

  async count(table: string, filters?: QueryFilter[]): Promise<number> {
    this.validateTable(table);
    try {
      return await this.adapter.count(table, filters);
    } catch (err) {
      throw this.error(
        err instanceof Error ? err.message : 'count failed',
        'ADAPTER'
      );
    }
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    try {
      return await this.adapter.healthCheck();
    } catch {
      return { ok: false, latencyMs: -1 };
    }
  }
}
