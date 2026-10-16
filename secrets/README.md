# `secrets/` — configuration contract & validation gate

This folder is **committed templates and logic only**. It must never contain a
real credential. Live values live in untracked `.env*` files beside each app or,
in production, in a managed secret store.

## Contents

| File | Purpose |
| --- | --- |
| `schema.ts` | Zod schemas: `ServerEnvObject`, `PublicEnvObject`, cross-key refinements. |
| `validate-env.ts` | Boot + CI gate. `validateEnv()` is importable; the CLI exits non-zero on failure. |
| `redact.ts` | Masks secret values so validation logs never leak them. |
| `.env.example` | Local-dev template (placeholders fail validation on purpose). |
| `.env.test.example` | CI template — fake but shape-valid values. |
| `.env.production.example` | Production **names only**; values come from a secret manager. |

## Usage

```bash
# Local dev
cp secrets/.env.example .env.local
tsx secrets/validate-env.ts --file .env.local

# CI (against injected env)
npm --prefix secrets run validate
```

The backend runtime imports the same schema, so app boot and CI cannot drift:

```ts
// backend/src/config/env.ts
import { ServerEnvSchema } from "../../../secrets/schema";
```

## What the gate cross-verifies

- Clerk `pk_*` / `sk_*` are the **same mode** (test vs live); `whsec_` shape.
- `SUPABASE_SERVICE_ROLE_KEY` is not a publishable/anon key.
- `EMBEDDING_DIM` equals the `vector(1536)` width in `backend/src/db/schema.sql`.
- Non-local `SUPABASE_URL` / `COMPLETION_BASE_URL` are `https` in production.
- No `NEXT_PUBLIC_*` value is secret-shaped (they are inlined into the browser).

## Handling rules (threat model)

1. **Never commit** `.env`, `.env.local`, `.env.test`, `.env.production`. The
   root `.gitignore` ignores `.env*` and whitelists only these `*.example` files.
2. **Rotate** on exposure; keys are never logged — errors print key names only.
3. **Promote** by copying the *shape*, not values: dev uses test-mode Clerk keys,
   prod uses live keys from the secret manager.
4. **Least privilege**: the service-role key is server-only and must never be
   prefixed `NEXT_PUBLIC_`.
