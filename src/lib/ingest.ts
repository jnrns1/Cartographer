import type { StoragePorts } from "./ports";
import { putBlobPart, reassembleBlob } from "./entities";

/**
 * Dual-mode zip ingestion (DECISIONS.md). `objectstore` (development/staging)
 * presigns a direct browser upload to the Object Store. `chunked`
 * (production-safe while Object Store is EAP) has the browser post <=200 KiB
 * base64 parts through a resolver, reassembled here. The brief caps the upload
 * at 10 MB compressed.
 */
export type IngestMode = "objectstore" | "chunked";

export const MAX_ZIP_BYTES = 10 * 1024 * 1024;
export const MAX_PART_BYTES = 200 * 1024;

export function zipObjectKey(scanId: string): string {
  return `scan/${scanId}/src.zip`;
}

/** Object Store presign for the browser upload (objectstore mode). */
export async function presignZipUpload(
  ports: StoragePorts,
  scanId: string,
  length: number,
  sha256: string,
): Promise<{ url: string }> {
  if (length <= 0 || length > MAX_ZIP_BYTES) {
    throw new Error(`zip length ${length} exceeds the ${MAX_ZIP_BYTES} byte cap`);
  }
  return ports.objects.createUploadUrl({
    key: zipObjectKey(scanId),
    length,
    checksum: sha256,
    checksumType: "SHA256",
    overwrite: true,
  });
}

/** Accept one base64 zip part (chunked mode). Resolver request stays < 500 KB. */
export async function acceptZipPart(
  ports: StoragePorts,
  scanId: string,
  partIndex: number,
  total: number,
  dataB64: string,
): Promise<void> {
  if (partIndex < 0 || total <= 0 || partIndex >= total) {
    throw new Error(`invalid blob part ${partIndex}/${total}`);
  }
  const decodedLen = Buffer.from(dataB64, "base64").length;
  if (decodedLen > MAX_PART_BYTES) {
    throw new Error(
      `blob part ${partIndex} is ${decodedLen} bytes, over the ${MAX_PART_BYTES} cap`,
    );
  }
  await putBlobPart(ports.entities, scanId, partIndex, total, dataB64);
}

/** Resolve the uploaded zip bytes for the worker, by mode. */
export async function loadZipBytes(
  ports: StoragePorts,
  mode: IngestMode,
  scanId: string,
  objectKey?: string,
): Promise<Uint8Array> {
  if (mode === "objectstore") {
    const bytes = await ports.objects.getBytes(
      objectKey ?? zipObjectKey(scanId),
    );
    if (!bytes) throw new Error(`uploaded zip not found for scan ${scanId}`);
    return bytes;
  }
  const bytes = await reassembleBlob(ports.entities, scanId);
  if (bytes.length === 0) {
    throw new Error(`no zip parts found for scan ${scanId}`);
  }
  return bytes;
}
