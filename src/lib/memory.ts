import type { ScanEvent } from "../types";
import type {
  EntityQuery,
  EntityStore,
  Kvs,
  ObjectStore,
  PresignedUrl,
  QueryPage,
  QueuePort,
  UploadUrlBody,
} from "./ports";

/**
 * In-memory fakes that mirror Forge storage semantics closely enough to drive
 * the whole pipeline offline: KVS get/set/delete, Custom Entity index queries
 * (single-attribute partition equality, ascending range sort, opaque cursor
 * pagination capped at 100), and an Object Store byte map.
 */
export class InMemoryKvs implements Kvs {
  private readonly map = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> {
    const v = this.map.get(key);
    return v === undefined ? undefined : (structuredClone(v) as T);
  }
  async set(key: string, value: unknown): Promise<void> {
    this.map.set(key, structuredClone(value));
  }
  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
}

export interface IndexSpec {
  partition: string;
  range?: string;
}
export type IndexSpecs = Record<string, Record<string, IndexSpec>>;

function encodeCursor(n: number): string {
  return Buffer.from(String(n), "utf8").toString("base64");
}
function decodeCursor(c?: string): number {
  if (!c) return 0;
  const n = Number(Buffer.from(c, "base64").toString("utf8"));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

export class InMemoryEntityStore implements EntityStore {
  private readonly data = new Map<string, Map<string, Record<string, unknown>>>();

  constructor(private readonly specs: IndexSpecs) {}

  private bucket(entity: string): Map<string, Record<string, unknown>> {
    let m = this.data.get(entity);
    if (!m) {
      m = new Map();
      this.data.set(entity, m);
    }
    return m;
  }

  async set(
    entity: string,
    key: string,
    value: Record<string, unknown>,
  ): Promise<void> {
    this.bucket(entity).set(key, structuredClone(value));
  }

  async get<T>(entity: string, key: string): Promise<T | undefined> {
    const v = this.bucket(entity).get(key);
    return v === undefined ? undefined : (structuredClone(v) as T);
  }

  async delete(entity: string, key: string): Promise<void> {
    this.bucket(entity).delete(key);
  }

  async query<T>(entity: string, q: EntityQuery): Promise<QueryPage<T>> {
    const spec = this.specs[entity]?.[q.index];
    if (!spec) {
      throw new Error(`unknown index ${entity}.${q.index}`);
    }
    let rows = [...this.bucket(entity).values()].filter(
      (r) => r[spec.partition] === q.partition,
    );
    if (q.range && spec.range) {
      const attr = spec.range;
      rows = rows.filter((r) => {
        const v = r[attr] as string | number;
        switch (q.range?.op) {
          case "eq":
            return v === q.range.value;
          case "lt":
            return compare(v, q.range.value) < 0;
          case "lte":
            return compare(v, q.range.value) <= 0;
          case "gt":
            return compare(v, q.range.value) > 0;
          case "gte":
            return compare(v, q.range.value) >= 0;
          case "beginsWith":
            return String(v).startsWith(String(q.range.value));
          default:
            return true;
        }
      });
    }
    if (spec.range) {
      const attr = spec.range;
      rows.sort((a, b) => compare(a[attr], b[attr]));
    }
    const start = decodeCursor(q.cursor);
    const limit = Math.max(1, Math.min(q.limit ?? 100, 100));
    const page = rows.slice(start, start + limit);
    const nextCursor =
      start + limit < rows.length ? encodeCursor(start + limit) : undefined;
    return {
      results: page.map((r) => structuredClone(r) as T),
      ...(nextCursor ? { nextCursor } : {}),
    };
  }
}

/** Records pushed events; a test harness drains them to drive the worker. */
export class InMemoryQueue implements QueuePort {
  readonly pushed: ScanEvent[] = [];
  async push(event: ScanEvent): Promise<void> {
    this.pushed.push(structuredClone(event));
  }
  take(): ScanEvent | undefined {
    return this.pushed.shift();
  }
}

export class InMemoryObjectStore implements ObjectStore {
  private readonly blobs = new Map<string, Uint8Array>();

  async createUploadUrl(body: UploadUrlBody): Promise<PresignedUrl> {
    return { url: `mem://put/${encodeURIComponent(body.key)}` };
  }
  async createDownloadUrl(key: string): Promise<PresignedUrl | undefined> {
    return this.blobs.has(key)
      ? { url: `mem://get/${encodeURIComponent(key)}` }
      : undefined;
  }
  async putBytes(key: string, bytes: Uint8Array): Promise<void> {
    this.blobs.set(key, Uint8Array.from(bytes));
  }
  async getBytes(key: string): Promise<Uint8Array | undefined> {
    const b = this.blobs.get(key);
    return b ? Uint8Array.from(b) : undefined;
  }
  async delete(key: string): Promise<void> {
    this.blobs.delete(key);
  }
}
