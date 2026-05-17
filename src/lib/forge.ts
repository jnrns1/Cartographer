import type { ScanEvent } from "../types";
import type {
  EntityQuery,
  EntityStore,
  Kvs,
  ObjectStore,
  PresignedUrl,
  QueryPage,
  QueuePort,
  StoragePorts,
  UploadUrlBody,
} from "./ports";

/**
 * Forge storage bindings. Verified against the live API 2026-05-17: the
 * Custom Entity + KVS API is the `@forge/kvs` package, Object Store is
 * `@forge/os` (EAP). These are exercised on the operator's deploy, not in the
 * offline gate (which uses the in-memory fakes), so modules are imported
 * lazily and the exact `WhereConditions` names and the `@forge/bridge`
 * objectStore->function payload are flagged NEEDS VERIFICATION in DECISIONS.
 */

// Loose shapes for the lazily imported Forge SDKs. Justified `any` per brief
// anti-pattern 6: these are external SDK surfaces whose exact builder typings
// resolve only at deploy time against the installed @forge/* versions.
type ForgeKvs = any; // eslint not configured; `any` justified above
type ForgeOs = any;

async function loadKvs(): Promise<ForgeKvs> {
  const mod = await import("@forge/kvs");
  return (mod as { default: ForgeKvs }).default;
}

async function loadOs(): Promise<ForgeOs> {
  const mod = await import("@forge/os");
  return (mod as { default: ForgeOs }).default;
}

function forgeKvs(): Kvs {
  return {
    async get<T>(key: string): Promise<T | undefined> {
      const kvs = await loadKvs();
      const v = await kvs.get(key);
      return (v ?? undefined) as T | undefined;
    },
    async set(key, value) {
      const kvs = await loadKvs();
      await kvs.set(key, value);
    },
    async delete(key) {
      const kvs = await loadKvs();
      await kvs.delete(key);
    },
  };
}

function forgeEntities(): EntityStore {
  return {
    async set(entity, key, value) {
      const kvs = await loadKvs();
      await kvs.entity(entity).set(key, value);
    },
    async get<T>(entity: string, key: string): Promise<T | undefined> {
      const kvs = await loadKvs();
      const v = await kvs.entity(entity).get(key);
      return (v ?? undefined) as T | undefined;
    },
    async delete(entity, key) {
      const kvs = await loadKvs();
      await kvs.entity(entity).delete(key);
    },
    async query<T>(entity: string, q: EntityQuery): Promise<QueryPage<T>> {
      if (q.range) {
        // The DAOs query by partition + cursor only (range ordering is
        // implicit in the declared index). A range condition would need the
        // exact @forge/kvs WhereConditions spelling, which is NEEDS
        // VERIFICATION AT BUILD TIME (DECISIONS.md). Fail loudly rather than
        // silently ignore it.
        throw new Error("range conditions are not wired in the Forge binding");
      }
      const kvs = await loadKvs();
      let builder = kvs
        .entity(entity)
        .query()
        .index(q.index)
        .partition(q.partition)
        .limit(Math.max(1, Math.min(q.limit ?? 100, 100)));
      if (q.cursor) builder = builder.cursor(q.cursor);
      const res = await builder.getMany();
      return {
        results: (res.results ?? []) as T[],
        ...(res.nextCursor ? { nextCursor: res.nextCursor as string } : {}),
      };
    },
  };
}

function forgeObjects(): ObjectStore {
  return {
    async createUploadUrl(body: UploadUrlBody): Promise<PresignedUrl> {
      const os = await loadOs();
      return os.createUploadUrl(body);
    },
    async createDownloadUrl(key: string): Promise<PresignedUrl | undefined> {
      const os = await loadOs();
      return (await os.createDownloadUrl(key)) ?? undefined;
    },
    async putBytes(key: string, bytes: Uint8Array): Promise<void> {
      const os = await loadOs();
      const { url } = await os.createUploadUrl({
        key,
        length: bytes.length,
        checksum: "",
        checksumType: "SHA256",
        overwrite: true,
      });
      // Cast: a Uint8Array is a valid fetch body at runtime; the DOM lib's
      // BodyInit union does not list it. Deploy-only path (DECISIONS.md).
      const r = await fetch(url, {
        method: "PUT",
        body: bytes as unknown as BodyInit,
      });
      if (!r.ok) throw new Error(`object PUT failed (${r.status}) for ${key}`);
    },
    async getBytes(key: string): Promise<Uint8Array | undefined> {
      const os = await loadOs();
      const dl = await os.createDownloadUrl(key);
      if (!dl) return undefined;
      const r = await fetch(dl.url);
      if (!r.ok) return undefined;
      return new Uint8Array(await r.arrayBuffer());
    },
    async delete(key: string): Promise<void> {
      const os = await loadOs();
      await os.delete(key);
    },
  };
}

export function createForgeStorage(): StoragePorts {
  return {
    kvs: forgeKvs(),
    entities: forgeEntities(),
    objects: forgeObjects(),
  };
}

/**
 * Forge async queue binding. The `@forge/events` Queue push API and the
 * consumer event shape are NEEDS VERIFICATION AT BUILD TIME (DECISIONS.md);
 * the manifest queue name is `scan-queue`.
 */
export function createForgeQueue(): QueuePort {
  return {
    async push(event: ScanEvent): Promise<void> {
      const mod = await import("@forge/events");
      const QueueCtor = (mod as { Queue: new (o: { key: string }) => ForgeOs })
        .Queue;
      const queue = new QueueCtor({ key: "scan-queue" });
      await queue.push(event);
    },
  };
}
