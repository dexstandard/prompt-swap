# prompt-swap

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

