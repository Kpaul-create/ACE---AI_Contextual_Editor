-- ============================================================================
-- ACE Contextual Editor - canonical database schema
-- Postgres 15+ with pgvector.
--
-- Embedding dimension is centralized as 1536 (OpenAI text-embedding-3-small /
-- ada-002 width). If you change embedding models, change EVERY 'vector(1536)'
-- occurrence below AND the parameter type in match_file_chunks().
-- ============================================================================

create extension if not exists "vector";
create extension if not exists "pg_trgm";
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- profiles: local mirror of Clerk users, written exclusively by the webhook.
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id                text primary key,                 -- Clerk user id (user_xxx)
  email             text,
  display_name      text,
  avatar_url        text,
  onboarding_status text not null default 'pending'
                      check (onboarding_status in ('pending', 'completed')),
  preferences       jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- projects: a user-owned workspace root.
-- ----------------------------------------------------------------------------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    text not null references public.profiles(id) on delete cascade,
  name        text not null,
  description text,
  language    text not null default 'plaintext',
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists projects_owner_idx on public.projects(owner_id);

-- ----------------------------------------------------------------------------
-- files: current content + indexing bookkeeping for a single source file.
-- ----------------------------------------------------------------------------
create table if not exists public.files (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  path         text not null,
  language     text not null default 'plaintext',
  content      text not null default '',
  content_hash text not null default '',              -- sha256 of content
  size_bytes   integer not null default 0,
  version      integer not null default 1,
  indexed_at   timestamptz,                           -- null => stale / not indexed
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (project_id, path)
);
create index if not exists files_project_idx on public.files(project_id);
create index if not exists files_project_lang_idx on public.files(project_id, language);

-- ----------------------------------------------------------------------------
-- file_chunks: retrieval units. Each row owns a dense embedding plus the
-- structural metadata the re-ranker and FIM formatter depend on.
-- ----------------------------------------------------------------------------
create table if not exists public.file_chunks (
  id          uuid primary key default gen_random_uuid(),
  file_id     uuid not null references public.files(id) on delete cascade,
  project_id  uuid not null references public.projects(id) on delete cascade,
  chunk_index integer not null,                       -- ordinal within the file
  content     text not null,
  token_count integer not null default 0,
  start_line  integer not null default 1,
  end_line    integer not null default 1,
  symbol      text,                                   -- enclosing fn/class/fqn, if known
  kind        text not null default 'block',          -- block | function | class | import | header
  metadata    jsonb not null default '{}'::jsonb,     -- imports, callers, language, hash...
  embedding   vector(1536),
  created_at  timestamptz not null default now()
);
create index if not exists file_chunks_file_idx on public.file_chunks(file_id);
create index if not exists file_chunks_project_idx on public.file_chunks(project_id);
create index if not exists file_chunks_content_trgm on public.file_chunks using gin (content gin_trgm_ops);
create index if not exists file_chunks_metadata_gin on public.file_chunks using gin (metadata jsonb_path_ops);

-- Approximate-nearest-neighbour index for semantic search (read-heavy => HNSW).
create index if not exists file_chunks_embedding_hnsw
  on public.file_chunks using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- ----------------------------------------------------------------------------
-- updated_at maintenance
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'projects', 'files'] loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at();', t);
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- Row Level Security. The service-role key bypasses RLS; these policies protect
-- any anon/authenticated access. Clerk is wired to Supabase as a third-party
-- auth provider, so the verified JWT subject is exposed via auth.jwt()->>'sub'.
-- ----------------------------------------------------------------------------
alter table public.profiles    enable row level security;
alter table public.projects    enable row level security;
alter table public.files       enable row level security;
alter table public.file_chunks enable row level security;

drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for all using (id = (auth.jwt() ->> 'sub'))
  with check (id = (auth.jwt() ->> 'sub'));

drop policy if exists projects_owner on public.projects;
create policy projects_owner on public.projects
  for all using (owner_id = (auth.jwt() ->> 'sub'))
  with check (owner_id = (auth.jwt() ->> 'sub'));

drop policy if exists files_via_project on public.files;
create policy files_via_project on public.files
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = files.project_id and p.owner_id = (auth.jwt() ->> 'sub')
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = files.project_id and p.owner_id = (auth.jwt() ->> 'sub')
    )
  );

drop policy if exists chunks_via_project on public.file_chunks;
create policy chunks_via_project on public.file_chunks
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = file_chunks.project_id and p.owner_id = (auth.jwt() ->> 'sub')
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = file_chunks.project_id and p.owner_id = (auth.jwt() ->> 'sub')
    )
  );

-- ----------------------------------------------------------------------------
-- Semantic retrieval RPC. pgvector cosine distance ('<=>') ascending => most
-- similar first; we surface 1 - distance as a bounded [0,1]-ish similarity.
-- ----------------------------------------------------------------------------
create or replace function public.match_file_chunks(
  p_project_id      uuid,
  p_query_embedding vector(1536),
  p_match_count     int   default 12,
  p_min_similarity  float default 0.0
)
returns table (
  id          uuid,
  file_id     uuid,
  chunk_index integer,
  content     text,
  token_count integer,
  start_line  integer,
  end_line    integer,
  symbol      text,
  kind        text,
  metadata    jsonb,
  similarity  float
)
language sql stable as $$
  select
    c.id,
    c.file_id,
    c.chunk_index,
    c.content,
    c.token_count,
    c.start_line,
    c.end_line,
    c.symbol,
    c.kind,
    c.metadata,
    1 - (c.embedding <=> p_query_embedding) as similarity
  from public.file_chunks c
  where c.project_id = p_project_id
    and c.embedding is not null
    and (1 - (c.embedding <=> p_query_embedding)) >= p_min_similarity
  order by c.embedding <=> p_query_embedding
  limit p_match_count;
$$;

-- ----------------------------------------------------------------------------
-- Lexical retrieval RPC, used for hybrid fusion. Trigram similarity keeps this
-- dependency-free (no external tsvector dictionaries per language).
-- ----------------------------------------------------------------------------
create or replace function public.search_file_chunks_lexical(
  p_project_id uuid,
  p_query      text,
  p_match_count int default 20
)
returns table (
  id          uuid,
  file_id     uuid,
  chunk_index integer,
  content     text,
  token_count integer,
  start_line  integer,
  end_line    integer,
  symbol      text,
  kind        text,
  metadata    jsonb,
  similarity  float
)
language sql stable as $$
  select
    c.id,
    c.file_id,
    c.chunk_index,
    c.content,
    c.token_count,
    c.start_line,
    c.end_line,
    c.symbol,
    c.kind,
    c.metadata,
    similarity(c.content, p_query) as similarity
  from public.file_chunks c
  where c.project_id = p_project_id
    and c.content % p_query                      -- trigram index prefilter
  order by similarity(c.content, p_query) desc
  limit p_match_count;
$$;
