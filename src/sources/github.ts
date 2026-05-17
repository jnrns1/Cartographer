import type { FileRef, SourceAdapter, SourceMetadata } from "../types";
import type { HttpClient } from "./http";
import { IgnoreSet, extOf, isScannable, parseIgnore } from "./ignore";

/**
 * Read-only GitHub source via the public REST API (brief 10.2). The recursive
 * git-tree endpoint lists blobs in one call; contents are fetched raw. The
 * token is passed in already resolved (the worker resolves the encrypted
 * tokenRef in P6). `api.github.com` egress is declared in the manifest.
 */
export interface GitHubConfig {
  /** "owner/repo". */
  repo: string;
  ref?: string;
  token: string;
}

interface TreeResponse {
  tree?: Array<{ path: string; type: string }>;
  truncated?: boolean;
}

const API = "https://api.github.com";

export class GitHubSource implements SourceAdapter {
  private readonly cfg: GitHubConfig;
  private readonly http: HttpClient;
  private readonly ref: string;

  constructor(cfg: GitHubConfig, http: HttpClient) {
    this.cfg = cfg;
    this.http = http;
    this.ref = cfg.ref && cfg.ref.length > 0 ? cfg.ref : "HEAD";
  }

  private headers(raw = false): Record<string, string> {
    return {
      Authorization: `Bearer ${this.cfg.token}`,
      Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "cartographer-for-atlassian",
    };
  }

  getMetadata(): SourceMetadata {
    return { kind: "github", label: this.cfg.repo };
  }

  private async loadIgnore(): Promise<IgnoreSet> {
    const url = `${API}/repos/${this.cfg.repo}/contents/.cartographerignore?ref=${encodeURIComponent(this.ref)}`;
    const res = await this.http.get(url, this.headers(true));
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

    const url = `${API}/repos/${this.cfg.repo}/git/trees/${encodeURIComponent(this.ref)}?recursive=1`;
    const res = await this.http.get(url, this.headers());
    if (!res.ok) {
      throw new Error(
        `GitHub tree request failed (${res.status}) for ${this.cfg.repo}`,
      );
    }
    const body = (await res.json()) as TreeResponse;
    for (const node of body.tree ?? []) {
      if (node.type !== "blob") continue;
      if (!isScannable(node.path)) continue;
      if (ignore.ignores(node.path)) continue;
      yield { path: node.path, ext: extOf(node.path) };
    }
  }

  async readFile(ref: FileRef): Promise<string> {
    const url = `${API}/repos/${this.cfg.repo}/contents/${ref.path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}?ref=${encodeURIComponent(this.ref)}`;
    const res = await this.http.get(url, this.headers(true));
    if (!res.ok) {
      throw new Error(`GitHub content request failed (${res.status}) for ${ref.path}`);
    }
    return res.text();
  }
}
