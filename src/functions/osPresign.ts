import type { ObjectStore } from "../lib/ports";
import { createForgeStorage } from "../lib/forge";

/**
 * Object Store presign function.
 *
 * Invoked by `@forge/bridge` `objectStore.upload` / `objectStore.download`
 * (the manifest `functionKey`, not a resolver). The exact bridge->function
 * payload is undocumented (NEEDS VERIFICATION AT BUILD TIME, DECISIONS.md), so
 * this accepts a defensive shape and the pure core `presign` is unit-tested
 * against the in-memory Object Store.
 */
export interface PresignPayload {
  action?: "upload" | "download";
  key: string;
  length?: number;
  checksum?: string;
  checksumType?: "SHA1" | "SHA256" | "CRC32" | "CRC32C";
  ttlSeconds?: number;
  overwrite?: boolean;
}

export interface PresignResult {
  url: string | null;
}

export async function presign(
  objects: ObjectStore,
  payload: PresignPayload,
): Promise<PresignResult> {
  if (!payload || typeof payload.key !== "string" || payload.key.length === 0) {
    throw new Error("presign: a non-empty object key is required");
  }
  if (payload.action === "download") {
    const dl = await objects.createDownloadUrl(payload.key);
    return { url: dl?.url ?? null };
  }
  const up = await objects.createUploadUrl({
    key: payload.key,
    length: payload.length ?? 0,
    checksum: payload.checksum ?? "",
    checksumType: payload.checksumType ?? "SHA256",
    ...(payload.ttlSeconds !== undefined
      ? { ttlSeconds: payload.ttlSeconds }
      : {}),
    overwrite: payload.overwrite ?? true,
  });
  return { url: up.url };
}

interface ForgeRequest {
  payload?: PresignPayload;
}

/** Manifest handler: index.osPresign. */
export async function osPresign(req: ForgeRequest): Promise<PresignResult> {
  const ports = createForgeStorage();
  return presign(ports.objects, req?.payload ?? ({} as PresignPayload));
}
