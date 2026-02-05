# chaaskit-demo

Persistent demo app for local development within the monorepo.

## Quick Start

1. Install dependencies from repo root:
   ```bash
   pnpm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your DATABASE_URL and API keys
   ```

3. Setup database:
   ```bash
   pnpm db:push
   ```

4. Start dev:
   ```bash
   pnpm dev
   ```

## Notes

- This app depends on local workspace packages (`@chaaskit/*`), so changes in this repo are picked up without publishing.
- For fastest iteration, run server/client watch builds alongside the demo app.
