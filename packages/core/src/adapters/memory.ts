import type { DataAdapter } from './adapter.js';
import type {
  QueryFilter,
  QueryOptions,
  PaginatedResult,
  DataRecord,
} from '../types/index.js';
import { DataError } from '../types/index.js';

let counter = 0;
function uuid(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  counter++;
  return `mem-${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 10)}`;
}

export class InMemoryAdapter implements DataAdapter {
  readonly provider = 'memory' as const;
  private tables = new Map<string, DataRecord[]>();

  private getTable(table: string): DataRecord[] {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table)!;
  }

  private applyFilters(records: DataRecord[], filters?: QueryFilter[]): DataRecord[] {
    if (!filters?.length) return records;
    return records.filter(r =>
      filters.every(f => {
        const val = r[f.field];
        switch (f.operator) {
          case 'eq': return val === f.value;
          case 'neq': return val !== f.value;
          case 'gt': return (val as number) > (f.value as number);
          case 'gte': return (val as number) >= (f.value as number);
          case 'lt': return (val as number) < (f.value as number);
          case 'lte': return (val as number) <= (f.value as number);
          case 'like': return String(val).includes(String(f.value).replace(/%/g, ''));
          case 'ilike': return String(val).toLowerCase().includes(String(f.value).replace(/%/g, '').toLowerCase());
          case 'in': return (f.value as unknown[]).includes(val);
          case 'is': return val === f.value;
          default: return true;
        }
      })
    );
  }

  async findMany<T extends DataRecord>(table: string, options?: QueryOptions): Promise<PaginatedResult<T>> {
    let records = [...this.getTable(table)];
    records = this.applyFilters(records, options?.filters);

    if (options?.orderBy?.length) {
      records.sort((a, b) => {
        for (const o of options.orderBy!) {
          const av = a[o.field], bv = b[o.field];
          if (av === bv) continue;
          const cmp = av! < bv! ? -1 : 1;
          return o.direction === 'desc' ? -cmp : cmp;
        }
        return 0;
      });
    }

    const total = records.length;
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 50;
    const data = records.slice(offset, offset + limit);

    return { data: data as T[], count: total, limit, offset, hasMore: offset + limit < total };
  }

  async findOne<T extends DataRecord>(table: string, id: string): Promise<T | null> {
    return (this.getTable(table).find(r => r.id === id) as T) ?? null;
  }

  async create<T extends DataRecord>(table: string, data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T> {
    const now = new Date().toISOString();
    const record = { ...data, id: uuid(), created_at: now, updated_at: now } as T;
    this.getTable(table).push(record as DataRecord);
    return record;
  }

  async createMany<T extends DataRecord>(table: string, items: Omit<T, 'id' | 'created_at' | 'updated_at'>[]): Promise<T[]> {
    return Promise.all(items.map(d => this.create<T>(table, d)));
  }

  async update<T extends DataRecord>(table: string, id: string, data: Partial<Omit<T, 'id' | 'created_at' | 'updated_at'>>): Promise<T> {
    const records = this.getTable(table);
    const idx = records.findIndex(r => r.id === id);
    const existing = records[idx];
    if (idx === -1 || !existing) throw new DataError(`Not found: ${id}`, 'NOT_FOUND');
    const updated = { ...existing, ...data, id: existing.id, updated_at: new Date().toISOString() } as DataRecord;
    records[idx] = updated;
    return updated as T;
  }

  async delete(table: string, id: string): Promise<void> {
    const records = this.getTable(table);
    const idx = records.findIndex(r => r.id === id);
    if (idx === -1) throw new DataError(`Not found: ${id}`, 'NOT_FOUND');
    records.splice(idx, 1);
  }

  async deleteMany(table: string, filters: QueryFilter[]): Promise<number> {
    const records = this.getTable(table);
    const toDelete = this.applyFilters(records, filters);
    const ids = new Set(toDelete.map(r => r.id));
    const before = records.length;
    this.tables.set(table, records.filter(r => !ids.has(r.id)));
    return before - this.getTable(table).length;
  }

  async count(table: string, filters?: QueryFilter[]): Promise<number> {
    return this.applyFilters(this.getTable(table), filters).length;
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    return { ok: true, latencyMs: 0 };
  }
}
