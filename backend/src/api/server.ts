import { buildApp } from "../app";
import { env } from "../config/env";

/** Bind the composed app to the network. Kept separate from app.ts for tests. */
export async function startServer(): Promise<void> {
  const app = buildApp();
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
  } catch (err) {
    app.log.error(err, "Failed to start server");
    process.exit(1);
  }
}
