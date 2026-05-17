/**
 * Path filtering for source adapters. Only CFML files are scanned, which also
 * bounds chunk counts. `.cartographerignore` (brief 10.2) and a small default
 * ignore set use gitignore-style globs.
 */
export const SCANNABLE_EXTS = new Set(["cfm", "cfc", "cfml"]);

export const DEFAULT_IGNORES = [
  "node_modules/",
  ".git/",
  "dist/",
  "build/",
  "vendor/",
  "target/",
  "coverage/",
  "**/*.min.js",
];

export function extOf(path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  return dot === -1 ? "" : base.slice(dot + 1).toLowerCase();
}

export function isScannable(path: string): boolean {
  return SCANNABLE_EXTS.has(extOf(path));
}

/** Parse `.cartographerignore` text into pattern strings. */
export function parseIgnore(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
}

function escapeRegExp(s: string): string {
  return s.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

/** Compile one gitignore-style pattern into a RegExp over a forward-slash path. */
function patternToRegExp(raw: string): RegExp {
  let p = raw.trim();
  const anchored = p.startsWith("/");
  if (anchored) p = p.slice(1);
  const dirOnly = p.endsWith("/");
  if (dirOnly) p = p.slice(0, -1);

  let body = "";
  for (let i = 0; i < p.length; i++) {
    const c = p[i] as string;
    if (c === "*") {
      if (p[i + 1] === "*") {
        body += ".*";
        i++;
        if (p[i + 1] === "/") i++;
      } else {
        body += "[^/]*";
      }
    } else if (c === "?") {
      body += "[^/]";
    } else {
      body += escapeRegExp(c);
    }
  }

  const prefix = anchored ? "^" : "(^|/)";
  const suffix = dirOnly ? "(/|$)" : "($|/)";
  return new RegExp(`${prefix}${body}${suffix}`);
}

export class IgnoreSet {
  private readonly regexes: RegExp[];

  constructor(patterns: string[]) {
    this.regexes = patterns.map(patternToRegExp);
  }

  static withDefaults(extra: string[] = []): IgnoreSet {
    return new IgnoreSet([...DEFAULT_IGNORES, ...extra]);
  }

  ignores(path: string): boolean {
    const norm = path.replace(/\\/g, "/").replace(/^\.\//, "");
    return this.regexes.some((r) => r.test(norm));
  }
}
