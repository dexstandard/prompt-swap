# Agent Guidelines

When a task touches only the backend or the frontend, scan only the
relevant directory to save time.

## Backend

### Folder overview
- `/backend/src/server.ts` bootstraps the Fastify server and cron scheduler.
- `/backend/src/routes` holds HTTP handlers.
- `/backend/src/repos` contains database repositories.
- `/backend/src/services` encapsulates business logic.
- `/backend/src/jobs` defines scheduled jobs.
- `/backend/src/db` keeps `schema.sql` and DB helpers.
- `/backend/test` contains backend tests.

### Scheduler Flow
cron → load users → plan action → simulate → execute → record result.

### Security Model
Trades execute on Binance using encrypted user API keys.
Only allowlisted token pairs are traded.

### Data Model
Tables:
- `users` — accounts and encrypted API keys.
- `executions` — records of performed trades.
- `agents` — user-configured trading bots.
- `agent_exec_log` — prompt/response history per agent.
- `agent_exec_result` — outcomes and rebalances.

### Config
Environment variables: `DATABASE_URL`, `KEY_PASSWORD`, `GOOGLE_CLIENT_ID`.

### Testing
- Backend tests require a local PostgreSQL server.
  - Check `psql` or `pg_isready` to confirm PostgreSQL is installed; install it if missing.
  - Start a database if needed:
    `docker run --rm --name promptswap-pg -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=promptswap_test -p 5432:5432 -d postgres:16`
  - Run tests with
    `DATABASE_URL=postgres://postgres:postgres@localhost:5432/promptswap_test npm --prefix backend test`.
  - `npm run build`

### Guidelines
- Do not write DB migrations during early development—edit `schema.sql` directly (unless this rule is removed).
- Cover backend code, especially API endpoints, with sufficient tests.
- New API endpoints should use the `RATE_LIMITS` presets for rate limiting.
- Use structured logging and include `userId`, `agentId`, and `execLogId` when available.
- Break down complex functions into reusable utilities and check for existing helpers before adding new ones.

## Frontend

### Folder overview
- `/frontend/src/main.tsx` is the entry point.
- `/frontend/src/components` contains reusable components and forms.
- `/frontend/src/routes` defines route components.
- `/frontend/src/lib` holds shared utilities.
- `/frontend/public` serves static assets.

### Config
Environment variables:
- `VITE_API_BASE` — override API base URL.
- `VITE_USE_MOCKS` — toggle mock API responses.
- `VITE_GOOGLE_CLIENT_ID` — OAuth client ID.

### Testing
- `npm --prefix frontend run lint`
  (no automated tests yet)

### Guidelines
- Reuse existing components (forms, tables, etc.) for consistent UI and validation.
- Break down complex components into smaller pieces and extract helper functions when needed.
