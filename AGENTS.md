# Agent Guidelines

Backend code lives in `/backend`; the React app lives in `/frontend`.

## Testing
- Run backend tests with `npm test` from the repository root.
- Frontend currently has no automated tests.

## Development
- Use `npm run dev` (or `./scripts/dev.sh`) to launch backend and frontend together.

## Development Guidelines
- Do not write DB migrations during early development - edit schema.sql directly (unless this rule is removed).
- Always cover backend code, especially API endpoints, with sufficient amount of tests.
- Reuse existing frontend form components (e.g., SelectInput, TokenSelect) for consistent UI and validation.
- New backend API endpoints should use the `RATE_LIMITS` presets for rate limiting.

