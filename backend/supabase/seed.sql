-- Local development seed. Assumes schema.sql has run and a profile exists.
-- Replace the owner id with a real Clerk user id before use.

-- insert into public.profiles (id, email, onboarding_status)
-- values ('user_xxxxxxxxxxxxxxxxxxxxx', 'dev@example.com', 'completed')
-- on conflict (id) do nothing;

-- insert into public.projects (id, owner_id, name, language)
-- values (
--   '00000000-0000-0000-0000-000000000001',
--   'user_xxxxxxxxxxxxxxxxxxxxx',
--   'Sample Workspace',
--   'typescript'
-- )
-- on conflict (id) do nothing;

-- insert into public.files (project_id, path, language, content, size_bytes)
-- values (
--   '00000000-0000-0000-0000-000000000001',
--   'src/main.ts',
--   'typescript',
--   'export const answer = () => 42;',
--   31
-- )
-- on conflict (project_id, path) do nothing;
