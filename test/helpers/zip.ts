import { deflateRawSync } from "node:zlib";

/**
 * Minimal in-memory ZIP builder for tests (store + deflate). CRC is left zero;
 * the production reader ignores it. Shared by the source-adapter and storage
 * suites so the zip-encoding logic lives in one place.
 */
export function buildZip(
  entries: Array<{ name: string; content: string; deflate?: boolean }>,
): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, "utf8");
    const raw = Buffer.from(e.content, "utf8");
    const data = e.deflate ? deflateRawSync(raw) : raw;
    const method = e.deflate ? 8 : 0;

    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(method, 8);
    lfh.writeUInt32LE(0, 14);
    lfh.writeUInt32LE(data.length, 18);
    lfh.writeUInt32LE(raw.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    const localStart = offset;
    locals.push(lfh, nameBuf, data);
    offset += 30 + nameBuf.length + data.length;

    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(method, 10);
    cdh.writeUInt32LE(0, 16);
    cdh.writeUInt32LE(data.length, 20);
    cdh.writeUInt32LE(raw.length, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt32LE(localStart, 42);
    centrals.push(cdh, nameBuf);
  }
  const cd = Buffer.concat(centrals);
  const localsBuf = Buffer.concat(locals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(localsBuf.length, 16);
  return Buffer.concat([localsBuf, cd, eocd]);
}
