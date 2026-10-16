/**
 * Test-only environment. env.ts validates at import time, so these must exist
 * before any service module is loaded. Values are deliberately fake.
 */
process.env.NODE_ENV ??= "test";
process.env.CLERK_SECRET_KEY ??= "sk_test_fake";
process.env.CLERK_WEBHOOK_SECRET ??= "whsec_fake";
process.env.SUPABASE_URL ??= "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role";
process.env.EMBEDDING_API_KEY ??= "test-embedding-key";
process.env.EMBEDDING_DIM ??= "1536";
process.env.COMPLETION_API_KEY ??= "test-completion-key";
process.env.COMPLETION_MODEL ??= "deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct";
