/**
 * Chunk planning for the async scan worker (P6 design). A scan slices its
 * file list into contiguous chunks small enough to finish well inside the
 * 900 s consumer budget. Events carry only {scanId, chunkIndex}; the file
 * list is read from the persisted manifest, never put on the event bus.
 *
 * Re-enqueue is linear-breadth: a bootstrap pushes up to MAX_EVENTS_PER_PUSH
 * chunk events plus at most one continuation event, so invocation depth stays
 * far below the platform's 1000 cyclic cap.
 */
export const MAX_CHUNK_FILES = 150;
export const MAX_EVENTS_PER_PUSH = 50;

export interface ChunkSpec {
  chunkIndex: number;
  start: number;
  end: number; // exclusive
}

export interface ChunkPlan {
  chunkTotal: number;
  chunkSize: number;
  totalFiles: number;
  chunks: ChunkSpec[];
}

export function planChunks(
  totalFiles: number,
  chunkSize: number = MAX_CHUNK_FILES,
): ChunkPlan {
  const size = Math.max(1, Math.min(chunkSize, MAX_CHUNK_FILES));
  const chunks: ChunkSpec[] = [];
  for (let start = 0, idx = 0; start < totalFiles; start += size, idx++) {
    chunks.push({
      chunkIndex: idx,
      start,
      end: Math.min(start + size, totalFiles),
    });
  }
  return {
    chunkTotal: chunks.length,
    chunkSize: size,
    totalFiles,
    chunks,
  };
}

/**
 * Split chunk indices into push batches that respect the per-request event
 * cap. The bootstrap sends batch 0; each batch's tail enqueues the next.
 */
export function eventBatches(
  chunkTotal: number,
  perPush: number = MAX_EVENTS_PER_PUSH,
): number[][] {
  const size = Math.max(1, Math.min(perPush, MAX_EVENTS_PER_PUSH));
  const batches: number[][] = [];
  for (let i = 0; i < chunkTotal; i += size) {
    batches.push(
      Array.from(
        { length: Math.min(size, chunkTotal - i) },
        (_, k) => i + k,
      ),
    );
  }
  return batches;
}
