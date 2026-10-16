import { getDb } from "../db/client";
import { FilesRepo } from "../db/repositories/files.repo";
import { indexFile } from "../services/rag";
import { env } from "../config/env";

/**
 * Async indexing worker.
 *
 * Small files are indexed inline by the file route, but large saves should not
 * block the HTTP response. This module exposes a fire-and-forget enqueue with
 * bounded concurrency. Swap the in-process queue for BullMQ/Temporal without
 * touching callers — the contract is just "given a fileId, make chunks fresh".
 */

const MAX_CONCURRENCY = 2;
let active = 0;
const queue: string[] = [];

export function enqueueIndex(fileId: string): void {
  queue.push(fileId);
  void drain();
}

async function drain(): Promise<void> {
  while (active < MAX_CONCURRENCY && queue.length > 0) {
    const fileId = queue.shift()!;
    active++;
    void runJob(fileId).finally(() => {
      active--;
      void drain();
    });
  }
}

async function runJob(fileId: string): Promise<void> {
  const db = getDb();
  const file = await new FilesRepo(db).get(fileId);
  if (!file) return;
  try {
    const count = await indexFile(db, {
      fileId: file.id,
      projectId: file.project_id,
      path: file.path,
      language: file.language,
      content: file.content,
      contentHash: file.content_hash,
    });
    // eslint-disable-next-line no-console
    console.info(`[index] file=${fileId} chunks=${count} budget=${env.CHUNK_MAX_TOKENS}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[index] file=${fileId} failed`, err);
  }
}
