// Types
export type {
  QueryFilter,
  QueryOptions,
  PaginatedResult,
  DataRecord,
  SupabaseAdapterConfig,
} from './types/index.js';

export { DataError } from './types/index.js';

// Adapter interface
export type { DataAdapter } from './adapters/adapter.js';

// Supabase adapter
export { SupabaseAdapter } from './adapters/supabase.js';

// Services
export { DataService } from './services/data.js';
