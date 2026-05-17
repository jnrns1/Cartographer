import type { SourceAdapter } from "../types";
import type { HttpClient } from "./http";
import { ZipSource } from "./zip";
import { GitHubSource } from "./github";
import { BitbucketSource } from "./bitbucket";
import { IgnoreSet } from "./ignore";

export { ZipSource } from "./zip";
export { GitHubSource, type GitHubConfig } from "./github";
export { BitbucketSource, type BitbucketConfig } from "./bitbucket";
export {
  IgnoreSet,
  parseIgnore,
  isScannable,
  extOf,
  SCANNABLE_EXTS,
  DEFAULT_IGNORES,
} from "./ignore";
export { type HttpClient, type HttpResponse, fetchHttpClient } from "./http";

/**
 * Build a SourceAdapter from a resolved source descriptor. Tokens are passed
 * in already decrypted (the worker resolves the encrypted tokenRef in P6).
 */
export type ResolvedSource =
  | { kind: "zip"; bytes: Uint8Array }
  | { kind: "github"; repo: string; ref?: string; token: string }
  | {
      kind: "bitbucket";
      workspace: string;
      repoSlug: string;
      ref?: string;
      token: string;
    };

export function createSource(
  source: ResolvedSource,
  http?: HttpClient,
): SourceAdapter {
  switch (source.kind) {
    case "zip":
      return new ZipSource(source.bytes, IgnoreSet.withDefaults());
    case "github":
      if (!http) throw new Error("GitHub source requires an HttpClient");
      return new GitHubSource(
        { repo: source.repo, ref: source.ref, token: source.token },
        http,
      );
    case "bitbucket":
      if (!http) throw new Error("Bitbucket source requires an HttpClient");
      return new BitbucketSource(
        {
          workspace: source.workspace,
          repoSlug: source.repoSlug,
          ref: source.ref,
          token: source.token,
        },
        http,
      );
  }
}
