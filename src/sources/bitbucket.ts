import type { FileRef, SourceAdapter, SourceMetadata } from "../types";
import type { HttpClient } from "./http";
import { IgnoreSet, extOf, isScannable, parseIgnore } from "./ignore";

/**
 * Read-only Bitbucket Cloud source via REST 2.0 (brief 10.3). v0.1 uses an
 * access token / app password (the brief's PAT fallback); the OAuth provider
 * is an operator add-on documented in RELEASE.md (DECISIONS.md). The `src`
 * endpoint lists one directory level per call, so directories are walked
 * breadth-first and pagination follows the `next` link.
 */
export interface BitbucketConfig {
  workspace: string;
  repoSlug: string;
  ref?: string;
  token: string;
}

interface SrcListing {
  values?: Array<{ path: string; type: string }>;
  next?: string;
}

const API = "https://api.bitbucket.org/2.0/repositories";

export class BitbucketSource implements SourceAdapter {
  private readonly cfg: BitbucketConfig;
  private readonly http: HttpClient;
  private readonly ref: string;
  private readonly base: string;

  constructor(cfg: BitbucketConfig, http: HttpClient) {
    this.cfg = cfg;
    this.http = http;
    this.ref = cfg.ref && cfg.ref.length > 0 ? cfg.ref : "main";
    this.base = `${API}/${cfg.workspace}/${cfg.repoSlug}`;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.cfg.token}`,
      Accept: "application/json",
    };
  }

  getMetadata(): SourceMetadata {
    return {
      kind: "bitbucket",
      label: `${this.cfg.workspace}/${this.cfg.repoSlug}`,
    };
  }

  private srcUrl(path: string): string {
    const enc = path
      .split("/")
      .filter(Boolean)
      .map(encodeURIComponent)
      .join("/");
    return `${this.base}/src/${encodeURIComponent(this.ref)}/${enc}${
      enc ? "/" : ""
    }?pagelen=100`;
  }

  private async loadIgnore(): Promise<IgnoreSet> {
    const res = await this.http.get(
      `${this.base}/src/${encodeURIComponent(this.ref)}/.cartographerignore`,
      this.headers(),
    );
    if (res.status === 200) {
      return IgnoreSet.withDefaults(parseIgnore(await res.text()));
    }
    return IgnoreSet.withDefaults();
  }

  async *listFiles(opts: {
    ignorePatterns: string[];
  }): AsyncIterable<FileRef> {
    const ignore = opts.ignorePatterns.length
      ? IgnoreSet.withDefaults(opts.ignorePatterns)
      : await this.loadIgnore();

    const queue: string[] = [""];
    const seen = new Set<string>();
    while (queue.length > 0) {
      const dir = queue.shift() as string;
      let url: string | undefined = this.srcUrl(dir);
      while (url) {
        if (seen.has(url)) break;
        seen.add(url);
        const res = await this.http.get(url, this.headers());
        if (!res.ok) {
          throw new Error(
            `Bitbucket src request failed (${res.status}) for "${dir}"`,
          );
        }
        const body = (await res.json()) as SrcListing;
        for (const v of body.values ?? []) {
          if (v.type === "commit_directory") {
            queue.push(v.path);
          } else if (v.type === "commit_file") {
            if (isScannable(v.path) && !ignore.ignores(v.path)) {
              yield { path: v.path, ext: extOf(v.path) };
            }
          }
        }
        url = body.next;
      }
    }
  }

  async readFile(ref: FileRef): Promise<string> {
    const enc = ref.path
      .split("/")
      .map(encodeURIComponent)
      .join("/");
    const res = await this.http.get(
      `${this.base}/src/${encodeURIComponent(this.ref)}/${enc}`,
      this.headers(),
    );
    if (!res.ok) {
      throw new Error(
        `Bitbucket content request failed (${res.status}) for ${ref.path}`,
      );
    }
    return res.text();
  }
}
