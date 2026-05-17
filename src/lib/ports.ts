/**
 * Storage seams. The worker, resolvers, and exporters depend only on these
 * interfaces, so the whole pipeline is unit-testable with in-memory fakes and
 * the Forge bindings (@forge/kvs, @forge/os) stay at the edges (DECISIONS.md).
 */

/** App key-value store (small singletons: config, per-project overrides). */
export interface Kvs {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface RangeCondition {
  op: "eq" | "lt" | "lte" | "gt" | "gte" | "beginsWith";
  value: string | number;
}

export interface EntityQuery {
  index: string;
  /** Single-attribute partition equality (manifest uses single-attr keys). */
  partition: string | number;
  /** Optional condition on the index range attribute. */
  range?: RangeCondition;
  /** 1..100 (Forge caps query results at 100). */
  limit?: number;
  /** Opaque cursor from a previous page; not stable across query shapes. */
  cursor?: string;
}

export interface QueryPage<T> {
  results: T[];
  nextCursor?: string;
}

/** Custom Entity Store (high-cardinality scan data, cursor pagination). */
export interface EntityStore {
  set(entity: string, key: string, value: Record<string, unknown>): Promise<void>;
  get<T>(entity: string, key: string): Promise<T | undefined>;
  delete(entity: string, key: string): Promise<void>;
  query<T>(entity: string, q: EntityQuery): Promise<QueryPage<T>>;
}

export interface PresignedUrl {
  url: string;
}

export interface UploadUrlBody {
  key: string;
  length: number;
  checksum: string;
  checksumType: "SHA1" | "SHA256" | "CRC32" | "CRC32C";
  ttlSeconds?: number;
  overwrite?: boolean;
}

/**
 * Object Store. createUploadUrl/createDownloadUrl back the browser presign
 * flow; putBytes/getBytes are the server-side convenience the worker and
 * exporters use (the Forge binding implements them via a presigned URL plus
 * an HTTP transfer). Object Store is EAP, so production uses the chunked
 * fallback instead (DECISIONS.md).
 */
export interface ObjectStore {
  createUploadUrl(body: UploadUrlBody): Promise<PresignedUrl>;
  createDownloadUrl(key: string): Promise<PresignedUrl | undefined>;
  putBytes(key: string, bytes: Uint8Array): Promise<void>;
  getBytes(key: string): Promise<Uint8Array | undefined>;
  delete(key: string): Promise<void>;
}

export interface StoragePorts {
  kvs: Kvs;
  entities: EntityStore;
  objects: ObjectStore;
}

/** Async event queue (Forge `@forge/events`). One logical queue, scan-queue. */
export interface QueuePort {
  push(event: import("../types").ScanEvent): Promise<void>;
}
