import { inflateRawSync } from "node:zlib";
import type { FileRef, SourceAdapter, SourceMetadata } from "../types";
import { IgnoreSet, extOf, isScannable } from "./ignore";

/**
 * Dependency-free ZIP reader (central-directory based, store + deflate). The
 * brief caps uploads at 10 MB compressed / 25 MB extracted, so 32-bit sizes
 * are sufficient and Zip64 is intentionally not handled (DECISIONS.md). The
 * worker reads entries one at a time and never persists file content past one
 * invocation (brief anti-pattern 4).
 */
interface ZipEntry {
  name: string;
  method: number;
  compSize: number;
  localOffset: number;
}

const EOCD_SIG = 0x06054b50;
const CD_SIG = 0x02014b50;
const LFH_SIG = 0x04034b50;

function toBuffer(bytes: Uint8Array): Buffer {
  return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
}

export function readZipEntries(bytes: Uint8Array): ZipEntry[] {
  const buf = toBuffer(bytes);
  // Locate the End Of Central Directory record (scan back over the comment).
  let eocd = -1;
  const minPos = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= minPos; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error("not a zip file: no end-of-central-directory");

  const total = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];
  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(p) !== CD_SIG) {
      throw new Error("corrupt zip: bad central directory signature");
    }
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const fnLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + fnLen);
    entries.push({ name, method, compSize, localOffset });
    p += 46 + fnLen + extraLen + commentLen;
  }
  return entries;
}

export function readZipEntryContent(
  bytes: Uint8Array,
  entry: ZipEntry,
): string {
  const buf = toBuffer(bytes);
  if (buf.readUInt32LE(entry.localOffset) !== LFH_SIG) {
    throw new Error(`corrupt zip: bad local header for ${entry.name}`);
  }
  const fnLen = buf.readUInt16LE(entry.localOffset + 26);
  const extraLen = buf.readUInt16LE(entry.localOffset + 28);
  const start = entry.localOffset + 30 + fnLen + extraLen;
  const comp = buf.subarray(start, start + entry.compSize);
  if (entry.method === 0) return comp.toString("utf8");
  if (entry.method === 8) return inflateRawSync(comp).toString("utf8");
  throw new Error(`unsupported zip compression method ${entry.method}`);
}

/** Strip a single shared top-level directory (typical of repo zip exports). */
function commonRoot(names: string[]): string {
  const tops = new Set(
    names.map((n) => (n.includes("/") ? n.slice(0, n.indexOf("/") + 1) : "")),
  );
  return tops.size === 1 && !tops.has("") ? [...tops][0]! : "";
}

export class ZipSource implements SourceAdapter {
  private readonly bytes: Uint8Array;
  private readonly ignore: IgnoreSet;
  private readonly root: string;
  private readonly byPath = new Map<string, ZipEntry>();

  constructor(bytes: Uint8Array, ignore: IgnoreSet = IgnoreSet.withDefaults()) {
    this.bytes = bytes;
    this.ignore = ignore;
    const entries = readZipEntries(bytes).filter((e) => !e.name.endsWith("/"));
    this.root = commonRoot(entries.map((e) => e.name));
    for (const e of entries) {
      const rel = this.root && e.name.startsWith(this.root)
        ? e.name.slice(this.root.length)
        : e.name;
      this.byPath.set(rel, e);
    }
  }

  getMetadata(): SourceMetadata {
    let count = 0;
    for (const path of this.byPath.keys()) {
      if (isScannable(path) && !this.ignore.ignores(path)) count++;
    }
    return { kind: "zip", label: "uploaded archive", fileCount: count };
  }

  async *listFiles(opts: {
    ignorePatterns: string[];
  }): AsyncIterable<FileRef> {
    const ignore = opts.ignorePatterns.length
      ? IgnoreSet.withDefaults(opts.ignorePatterns)
      : this.ignore;
    for (const path of this.byPath.keys()) {
      if (!isScannable(path)) continue;
      if (ignore.ignores(path)) continue;
      yield { path, ext: extOf(path) };
    }
  }

  async readFile(ref: FileRef): Promise<string> {
    const entry = this.byPath.get(ref.path);
    if (!entry) throw new Error(`zip entry not found: ${ref.path}`);
    return readZipEntryContent(this.bytes, entry);
  }

  /** Read `.cartographerignore` at the archive root if present. */
  async readIgnoreFile(): Promise<string | null> {
    const entry = this.byPath.get(".cartographerignore");
    return entry ? readZipEntryContent(this.bytes, entry) : null;
  }
}
