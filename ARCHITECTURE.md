# ACE AI IDE Architecture

```mermaid
flowchart LR
  user["Developer"]

  subgraph browser["Browser — Next.js 15 / React"]
    routes["App Router<br/>Landing · Sign in/up · Workspace"]
    auth["Clerk client + route middleware"]
    shell["EditorShell"]
    ui["File explorer · Monaco<br/>Agent panel · Browser pane · Terminal"]
    state["Zustand stores<br/>Files · Cursor · Provider · Workspace"]
    runtime["WebContainer runtime<br/>Virtual filesystem · Shell"]
    compile["esbuild Web Worker"]
    localMemory["OPFS + SQLite WASM worker<br/>Transformers.js embeddings"]
    collab["Yjs + WebRTC<br/>Peer presence"]
    routes --> auth --> shell --> ui
    ui <--> state
    ui --> runtime
    ui --> compile
    ui -. "memory adapter (available)" .-> localMemory
    ui -. "peer presence" .-> collab
  end

  subgraph next["Next.js server"]
    rewrite["/api/v1 rewrite"]
    clerkMiddleware["Clerk middleware<br/>Protect workspace and onboarding"]
  end

  subgraph backend["Fastify backend"]
    api["REST API<br/>Projects · Files · Onboarding · Browser"]
    apiAuth["Clerk request authentication"]
    complete["POST /editor/complete"]
    rag["RAG pipeline<br/>Chunk · Embed · Retrieve · FIM format"]
    index["File indexing<br/>Structural chunks + embeddings"]
    browserService["Browser session manager<br/>Puppeteer contexts"]
    webhook["Clerk webhook<br/>Profile sync + starter workspace"]
    api --> apiAuth
    apiAuth --> complete
    apiAuth --> index
    api --> browserService
    complete --> rag
  end

  subgraph data["Hosted services"]
    db[("Supabase Postgres<br/>Profiles · Projects · Files · Chunks")]
    vectors["pgvector semantic search<br/>+ pg_trgm lexical search"]
    embed["OpenAI-compatible<br/>embedding API"]
    model["Configured completion provider<br/>OpenAI-compatible / Anthropic"]
    clerk["Clerk identity"]
  end

  subgraph external["External browser targets"]
    grok["Grok"]
    venice["Venice"]
    opencode["OpenCode"]
  end

  ui -- "HTTP /api/v1/*" --> rewrite --> api
  clerkMiddleware -. "session protection" .-> clerk
  auth <--> clerk
  rag --> vectors
  rag --> embed
  vectors <--> db
  index --> embed
  index --> db
  rag -- "streamed completion" --> model
  browserService --> grok
  browserService --> venice
  browserService --> opencode
  clerk -- "Svix-signed webhook" --> webhook --> db
  user --> browser

  classDef planned stroke-dasharray: 5 5;
  class localMemory,collab planned;
```

## Main AI completion path

```mermaid
sequenceDiagram
  actor Developer
  participant UI as Agent panel / client
  participant Next as Next.js rewrite
  participant API as Fastify + Clerk auth
  participant RAG as Retrieval + FIM formatter
  participant DB as Supabase / pgvector
  participant Embed as Embedding API
  participant LLM as Completion provider

  Developer->>UI: Ask for completion or code help
  UI->>Next: POST /api/v1/editor/complete
  Next->>API: Forward request
  API->>API: Verify user and project ownership
  API->>RAG: Build query from cursor context
  RAG->>Embed: Embed retrieval query
  Embed-->>RAG: Query vector
  par Semantic retrieval
    RAG->>DB: match_file_chunks (pgvector)
    DB-->>RAG: Ranked chunks
  and Lexical retrieval
    RAG->>DB: search_file_chunks_lexical (pg_trgm)
    DB-->>RAG: Ranked chunks
  end
  RAG->>RAG: Fuse ranks, expand symbols, pack token budget, format FIM
  API-->>UI: SSE context event
  API->>LLM: Stream formatted FIM prompt
  LLM-->>API: Generated tokens
  API-->>UI: SSE content, usage, done events
  UI-->>Developer: Render assistant response
```

## Data and feature boundaries

- The workspace UI keeps its active file tree in a Zustand store. The terminal
  mounts those files into the browser WebContainer before running commands.
  The current workspace file tree is not automatically persisted to the
  backend's Supabase file tables.
- The Fastify file API stores project files in Supabase and indexes saved files
  as structural chunks with embeddings. Retrieval combines semantic and
  lexical search; symbol expansion is optional input to the retrieval layer.
- The Agent panel calls the completion endpoint, but currently sends a
  placeholder project ID; the backend checks project ownership, so this needs
  a real project ID before agent requests can succeed. The Monaco editor
  provides editing and cursor tracking; the API driver and inline-completion
  wiring are not currently enabled.
- The browser pane uses backend-managed Puppeteer sessions for Grok, Venice,
  or OpenCode. Its session endpoints allow guest sessions; this is separate
  from the WebContainer used for local code execution.
- Local OPFS memory, Yjs/WebRTC collaboration, and WebContainer execution are
  present as client-side adapters/features. Local memory is not part of the
  backend RAG pipeline.
- The Chrome extension driver, direct BYOK API driver, TypeScript agent loop,
  client audit, and static-export cutover are planned feature-flag stages, not
  active architecture paths.
