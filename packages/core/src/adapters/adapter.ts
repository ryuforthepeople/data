import type {
  QueryFilter,
  QueryOptions,
  PaginatedResult,
  DataRecord,
} from '../types/index.js';

export interface DataAdapter {
  readonly provider: 'supabase' | 'firebase' | 'pocketbase' | 'postgres' | string;

  findMany<T extends DataRecord>(
    table: string,
    options?: QueryOptions
  ): Promise<PaginatedResult<T>>;

  findOne<T extends DataRecord>(
    table: string,
    id: string
  ): Promise<T | null>;

  create<T extends DataRecord>(
    table: string,
    data: Omit<T, 'id' | 'created_at' | 'updated_at'>
  ): Promise<T>;

  createMany<T extends DataRecord>(
    table: string,
    data: Omit<T, 'id' | 'created_at' | 'updated_at'>[]
  ): Promise<T[]>;

  update<T extends DataRecord>(
    table: string,
    id: string,
    data: Partial<Omit<T, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<T>;

  delete(table: string, id: string): Promise<void>;

  deleteMany(table: string, filters: QueryFilter[]): Promise<number>;

  count(table: string, filters?: QueryFilter[]): Promise<number>;

  healthCheck(): Promise<{ ok: boolean; latencyMs: number }>;
}
