# ACE — AI Contextual Editor

Next.js 15 (App Router) frontend + Fastify "RAG 2.0" backend with Clerk auth,
Supabase/pgvector, and fill-in-the-middle code completion.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the system diagram and AI completion flow.

## Prerequisites

- Node.js >= 20
- A Clerk application (this project is already linked via the Clerk CLI)
- A Supabase project with pgvector enabled
- An embedding API key (OpenAI-compatible) and a completion API key

## Setup

1. Clerk: `clerk init` has already written `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
   `CLERK_SECRET_KEY`, and `CLERK_WEBHOOK_SECRET` to `.env.local`.
2. Add the backend secrets to `backend/.env` (template: `backend/.env.example`):
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `EMBEDDING_API_KEY` (optionally `EMBEDDING_BASE_URL`)
   - `COMPLETION_API_KEY` (optionally `COMPLETION_MODEL`)

   All values are validated at boot by `secrets/schema.ts` — the server refuses
   to start on missing or placeholder values.
3. Apply the database schema:

   ```bash
   psql "$DATABASE_URL" -f backend/src/db/schema.sql
   ```

   (or paste `backend/src/db/schema.sql` into the Supabase SQL editor)

## Run

```bash
# backend → http://localhost:8080
cd backend && npm install && npm run dev

# frontend → http://localhost:3000
npm install && npm run dev
```

The frontend proxies `/api/v1/*` to the backend (see `next.config.ts`).

## Project layout

- `app/` — route groups: `(auth)` sign-in/sign-up, `(dashboard)` onboarding,
  `(editor)` workspace editor
- `components/` — editor panes (file explorer, Monaco, browser pane, status bar),
  onboarding wizard, shared `GlassWindow`, shadcn/ui primitives
- `stores/` — Zustand stores (file tree, editor cursor, session, workspace)
- `middleware.ts` — Clerk route protection for `/onboarding` and `/workspace`
- `backend/` — Fastify service: RAG pipeline (chunker → embedder → retriever →
  FIM formatter), SSE completion streaming, browser automation, Clerk webhooks
- `secrets/` — shared env schema + validation gate (`tsx secrets/validate-env.ts`)

## Clerk

- Auth pages: `/sign-in`, `/sign-up` (route group `(auth)`)
- Protected routes: `/onboarding`, `/workspace/*` (see `middleware.ts`)
- Webhook: `POST /webhooks/clerk` (Svix-verified) — syncs profiles and
  provisions the starter workspace when onboarding completes
- Verify the setup: `clerk doctor`

## Tests

```bash
cd backend && npm test     # chunker + FIM formatter unit tests
```
