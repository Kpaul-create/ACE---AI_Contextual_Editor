# ACE Backend — RAG 2.0 Contextual Editor

Fastify (TypeScript) service powering the ACE editor: Clerk-authenticated,
Supabase/pgvector-backed, and built around a **Fill-in-the-Middle** code
completion pipeline where retrieval and generation are co-designed.

## Why "RAG 2.0" here

A generic RAG wrapper bolts a retriever onto a chat model and hopes the JSON
prompt lines up. This service instead treats retrieval and the CLM as one system:

- the **chunker** produces structural units (functions/classes/imports), not
  character windows, so retrieved context is coherent code;
- the **retriever** fuses semantic (pgvector) + lexical (trigram) ranking with
  Reciprocal Rank Fusion and packs within the model's token budget;
- the **FIM formatter** is the single bridge to the model: it lays out
  prefix/suffix/context using the exact control tokens the model expects and
  escapes anything that could forge a sentinel.

## Layout

```
src/
  config/     env validation + Clerk webhook verification/processors
  db/         supabase client, schema.sql, repositories
  services/
    rag/        chunker, embedder, retriever, fimFormatter, fimModel, facade
    completion/ provider (OpenAI/Anthropic/DeepInfra) + SSE serializer
    onboarding/ idempotent workspace provisioner
  api/v1/     middleware (auth/validate/errors), schemas, routes
  jobs/       async indexing worker
```

## FIM token reference

| Model family        | prefix            | suffix           | middle           |
| ------------------- | ----------------- | ---------------- | ---------------- |
| DeepSeek-Coder      | `<｜fim▁begin｜>`  | `<｜fim▁hole｜>`  | `<｜fim▁end｜>`   |
| OpenAI / StarCoder  | `<|fim_prefix|>`  | `<|fim_suffix|>` | `<|fim_middle|>` |
| Codestral / Mistral | `[PREFIX]`        | `[SUFFIX]`       | `[MIDDLE]`       |

The formatter emits `PREFIX <prefix> prefix <suffix> suffix <middle>` and lets
the model generate the middle. Retrieved context is prepended as a commented
block, highest-scoring chunk nearest the hole.

## Endpoints (`/api/v1`)

| Method | Path                 | Purpose                                        |
| ------ | -------------------- | ---------------------------------------------- |
| POST   | `/onboarding`        | Persist preferences + provision starter project |
| GET    | `/projects`          | List caller's projects                          |
| POST   | `/projects`          | Create project                                  |
| GET    | `/projects/:id`      | Fetch owned project                             |
| PATCH  | `/projects/:id`      | Update owned project                            |
| DELETE | `/projects/:id`      | Delete owned project                            |
| GET    | `/files?projectId=`  | List project files                              |
| POST   | `/files`             | Create file + index synchronously               |
| GET    | `/files/:id`         | Fetch file                                      |
| PATCH  | `/files/:id`         | Update content, bump version, re-index           |
| DELETE | `/files/:id`         | Delete file                                     |
| GET    | `/files/:id/chunks`  | Inspect retrieval units                         |
| POST   | `/editor/complete`   | **Streaming FIM completion (SSE)**              |

Plus `GET /health` and `POST /webhooks/clerk` (Svix-verified).

### Streaming contract

`POST /editor/complete` responds with `text/event-stream`. Each frame is JSON:

```
data: {"type":"context","contextBlocks":[...]}
data: {"type":"content","text":"return "}
data: {"type":"content","text":"value * 2;"}
data: {"type":"usage","usage":{"promptTokens":812,"completionTokens":7}}
data: {"type":"done"}
```

## Setup

```bash
cd backend
cp .env.example .env         # fill Clerk, Supabase, model keys
npm install

# apply the schema to your database (Supabase SQL editor or psql)
psql "$DATABASE_URL" -f src/db/schema.sql

npm run dev                  # http://localhost:8080
npm test                     # unit tests (chunker, fimFormatter)
npm run typecheck
```

### Clerk webhook

In the Clerk dashboard create an endpoint → `https://<host>/webhooks/clerk`
subscribing to `user.created`, `user.updated`, `user.deleted`. Copy the signing
secret into `CLERK_WEBHOOK_SECRET`. Onboarding completion is signalled by
setting `public_metadata.onboardingCompleted = true` from the Next.js wizard.

## Notes / limits

- Embedding dimension is fixed at **1536** in `schema.sql`; change it in the
  table, the `match_file_chunks` signature, and `EMBEDDING_DIM` together.
- The indexer's replace (delete-then-insert) is not transactional across both
  statements; for very large files move it behind the async job and a DB function.
- `provisional` starter content is seeded only once per user (idempotent).
```
