# prompt-swap

Currently swaps tokens via Binance using user-provided API keys.

## Run locally

1. Install dependencies:

   ```bash
   npm --prefix backend install
   npm --prefix frontend install
   ```

2. Configure environment variables:

   - Copy `backend/.env.example` to `backend/.env` and set values for `KEY_PASSWORD` and `GOOGLE_CLIENT_ID`.
   - Copy `frontend/.env.example` to `frontend/.env` and set `VITE_GOOGLE_CLIENT_ID` (should match `GOOGLE_CLIENT_ID`).
   - In Google Cloud Console, add `http://localhost:5173` to your OAuth client’s Authorized JavaScript origins.

3. Start the development servers:

   ```bash
   npm run dev
   ```

## Testing

Backend tests require a local PostgreSQL server. Start one with Docker:

```bash
docker run --rm --name promptswap-pg -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=promptswap_test -p 5432:5432 -d postgres:16
```

Run the tests:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/promptswap_test npm test
```

When you're done, stop the database:

```bash
docker stop promptswap-pg
```

## Continuous Integration

A GitHub Actions workflow (`.github/workflows/ci.yml`) installs dependencies, lints the frontend, runs backend tests, and builds the TypeScript backend. On pushes to `main`, the workflow deploys the project to a DigitalOcean droplet with Docker Compose.

## Production deployment

The project includes a Docker Compose setup for deploying to a DigitalOcean droplet. It builds the backend service and a Caddy server that serves the frontend and proxies API requests.

1. Set a `DOMAIN` environment variable to your droplet's domain.
2. Run `docker compose up -d` on the droplet to build and start the containers.
3. Caddy will automatically obtain TLS certificates for the provided domain.

For automated deployments, configure GitHub repository secrets:
 - `DO_SSH_HOST`: droplet IP or hostname.
 - `DO_SSH_USER`: SSH username.
 - `DO_SSH_PRIVATE_KEY`: private key for SSH access.
 - `DOMAIN`: domain name for TLS certificates.
 - `KEY_PASSWORD`: password for encrypting sensitive keys.
 - `GOOGLE_CLIENT_ID`: OAuth client ID used by both backend and frontend.
 - `DB_CONNECTION_STR`: PostgreSQL connection string used by the backend.

The CI workflow injects these secrets as environment variables when running `docker compose` during deployment.
