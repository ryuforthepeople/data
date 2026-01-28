# @for-the-people/data

Generic data module for the For the People ecosystem. Provider-agnostic CRUD with a Supabase adapter included.

## Packages

- **@for-the-people/data-core** — TypeScript types, adapter interface, Supabase adapter, DataService
- **@for-the-people/data-api** — Hono REST API with generic CRUD routes

## Quick Start

```bash
pnpm install
pnpm build
```

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/:table` | List records (paginated, filterable) |
| GET | `/api/v1/:table/:id` | Get single record |
| POST | `/api/v1/:table` | Create record |
| POST | `/api/v1/:table/batch` | Create multiple records |
| PUT | `/api/v1/:table/:id` | Update record |
| DELETE | `/api/v1/:table/:id` | Delete record |
| GET | `/api/v1/:table/count` | Count records |
| GET | `/api/v1/health` | Health check |

### Query Parameters

- `filter=field:op:value` — Filter (repeatable). Operators: eq, neq, gt, gte, lt, lte, like, ilike, in, is
- `orderBy=field:asc` — Order by (repeatable)
- `limit=50` — Page size
- `offset=0` — Page offset
- `select=col1,col2` — Column selection

## Architecture

```
DataAdapter (interface) → SupabaseAdapter (implementation)
       ↓
DataService (validation, caching, error wrapping)
       ↓
Hono API (REST routes, middleware)
```
