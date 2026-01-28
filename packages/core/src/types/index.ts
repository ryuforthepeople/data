// ─── Query Types ───

export interface QueryFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'is';
  value: unknown;
}

export interface QueryOptions {
  filters?: QueryFilter[];
  orderBy?: { field: string; direction: 'asc' | 'desc' }[];
  limit?: number;
  offset?: number;
  select?: string[];
}

export interface PaginatedResult<T> {
  data: T[];
  count: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ─── Data Record ───

export interface DataRecord {
  id: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

// ─── Adapter Config ───

export interface SupabaseAdapterConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

// ─── Errors ───

export class DataError extends Error {
  constructor(
    message: string,
    public readonly code: 'VALIDATION' | 'NOT_FOUND' | 'ADAPTER' | 'UNKNOWN',
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'DataError';
  }
}
