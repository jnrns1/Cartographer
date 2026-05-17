import { readdirSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";
import { scanFile, synthesize } from "../../src/domain";
import type { CandidateMatch, FileRef, WorkItem } from "../../src/types";

const FIXBAD = join(process.cwd(), "test", "fixtures", "bad");

/** Deterministic work items from scanning the bad-fixture corpus. */
export function badWorkItems(
  scanId = "scan-1",
  detectedAt = "2026-05-17T10:00:00.000Z",
): WorkItem[] {
  const candidates: CandidateMatch[] = [];
  const fileLoc: Record<string, number> = {};
  for (const name of readdirSync(FIXBAD)) {
    const abs = join(FIXBAD, name);
    const ref: FileRef = {
      path: `bad/${name}`,
      ext: extname(abs).slice(1).toLowerCase(),
    };
    const content = readFileSync(abs, "utf8");
    fileLoc[ref.path] = content.split("\n").length;
    candidates.push(...scanFile(ref, content));
  }
  return synthesize({ candidates, fileLoc, scanId, detectedAt });
}
