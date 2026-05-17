import { describe, it, expect } from "vitest";
import { buildZip } from "../helpers/zip";
import {
  ZipSource,
  GitHubSource,
  BitbucketSource,
  IgnoreSet,
  parseIgnore,
  createSource,
  type HttpClient,
} from "../../src/sources";
import type { FileRef } from "../../src/types";

async function collect(src: {
  listFiles(o: { ignorePatterns: string[] }): AsyncIterable<FileRef>;
}): Promise<string[]> {
  const out: string[] = [];
  for await (const f of src.listFiles({ ignorePatterns: [] })) out.push(f.path);
  return out.sort();
}

describe("ignore matching", () => {
  it("parses .cartographerignore, skipping comments and blanks", () => {
    expect(parseIgnore("# c\n\nfoo/\n bar.cfm ")).toEqual(["foo/", "bar.cfm"]);
  });

  it("matches directory, glob, and double-star patterns", () => {
    const set = new IgnoreSet(["legacy/", "**/*.gen.cfc", "/root.cfm"]);
    expect(set.ignores("legacy/User.cfc")).toBe(true);
    expect(set.ignores("a/b/x.gen.cfc")).toBe(true);
    expect(set.ignores("root.cfm")).toBe(true);
    expect(set.ignores("src/root.cfm")).toBe(false);
    expect(set.ignores("src/User.cfc")).toBe(false);
  });
});

describe("ZipSource", () => {
  const zip = buildZip([
    { name: "repo-main/src/User.cfc", content: "<cfset x = 1>" },
    { name: "repo-main/views/list.cfm", content: "<cfoutput>1</cfoutput>", deflate: true },
    { name: "repo-main/node_modules/lib.cfm", content: "ignored" },
    { name: "repo-main/README.md", content: "# not scannable" },
    { name: "repo-main/.cartographerignore", content: "views/\n" },
  ]);

  it("lists only scannable, non-ignored files and strips the common root", async () => {
    const src = new ZipSource(zip);
    expect(await collect(src)).toEqual(["src/User.cfc", "views/list.cfm"]);
  });

  it("reads stored and deflated entries", async () => {
    const src = new ZipSource(zip);
    expect(await src.readFile({ path: "src/User.cfc", ext: "cfc" })).toBe(
      "<cfset x = 1>",
    );
    expect(await src.readFile({ path: "views/list.cfm", ext: "cfm" })).toBe(
      "<cfoutput>1</cfoutput>",
    );
  });

  it("honors an in-archive .cartographerignore when applied", async () => {
    const src = new ZipSource(zip);
    const ignoreText = await src.readIgnoreFile();
    expect(ignoreText).toContain("views/");
    const set = IgnoreSet.withDefaults(parseIgnore(ignoreText ?? ""));
    const filtered = new ZipSource(zip, set);
    expect(await collect(filtered)).toEqual(["src/User.cfc"]);
  });

  it("reports metadata and rejects a non-zip buffer", () => {
    expect(new ZipSource(zip).getMetadata()).toMatchObject({
      kind: "zip",
      fileCount: 2,
    });
    expect(() => new ZipSource(Buffer.from("not a zip"))).toThrow(/zip/i);
  });

  it("builds via the factory", async () => {
    const src = createSource({ kind: "zip", bytes: zip });
    expect((await collect(src)).length).toBe(2);
  });
});

function mockHttp(routes: Record<string, { status: number; body: string }>): HttpClient {
  return {
    async get(url) {
      const r = routes[url] ?? { status: 404, body: "" };
      return {
        status: r.status,
        ok: r.status >= 200 && r.status < 300,
        text: async () => r.body,
        json: async () => JSON.parse(r.body || "{}"),
      };
    },
  };
}

describe("GitHubSource", () => {
  const repo = "acme/legacy";
  const tree = `${"https://api.github.com"}/repos/${repo}/git/trees/HEAD?recursive=1`;
  const ignoreUrl = `${"https://api.github.com"}/repos/${repo}/contents/.cartographerignore?ref=HEAD`;

  it("lists scannable blobs and reads raw content", async () => {
    const http = mockHttp({
      [ignoreUrl]: { status: 404, body: "" },
      [tree]: {
        status: 200,
        body: JSON.stringify({
          tree: [
            { path: "src/A.cfc", type: "blob" },
            { path: "src/B.cfm", type: "blob" },
            { path: "docs/readme.md", type: "blob" },
            { path: "src", type: "tree" },
          ],
        }),
      },
      [`https://api.github.com/repos/${repo}/contents/src/A.cfc?ref=HEAD`]: {
        status: 200,
        body: "component {}",
      },
    });
    const src = new GitHubSource({ repo, token: "t" }, http);
    expect(await collect(src)).toEqual(["src/A.cfc", "src/B.cfm"]);
    expect(await src.readFile({ path: "src/A.cfc", ext: "cfc" })).toBe(
      "component {}",
    );
    expect(src.getMetadata()).toEqual({ kind: "github", label: repo });
  });

  it("throws a clear error when the tree request fails", async () => {
    const http = mockHttp({ [ignoreUrl]: { status: 404, body: "" } });
    const src = new GitHubSource({ repo, token: "t" }, http);
    await expect(collect(src)).rejects.toThrow(/GitHub tree request failed/);
  });
});

describe("BitbucketSource", () => {
  const base = "https://api.bitbucket.org/2.0/repositories/team/app";
  it("walks directories breadth-first and reads raw files", async () => {
    const http = mockHttp({
      [`${base}/src/main/.cartographerignore`]: { status: 404, body: "" },
      [`${base}/src/main/?pagelen=100`]: {
        status: 200,
        body: JSON.stringify({
          values: [
            { path: "Application.cfc", type: "commit_file" },
            { path: "models", type: "commit_directory" },
          ],
        }),
      },
      [`${base}/src/main/models/?pagelen=100`]: {
        status: 200,
        body: JSON.stringify({
          values: [{ path: "models/User.cfc", type: "commit_file" }],
        }),
      },
      [`${base}/src/main/Application.cfc`]: { status: 200, body: "// app" },
    });
    const src = new BitbucketSource(
      { workspace: "team", repoSlug: "app", token: "t" },
      http,
    );
    expect(await collect(src)).toEqual(["Application.cfc", "models/User.cfc"]);
    expect(await src.readFile({ path: "Application.cfc", ext: "cfc" })).toBe(
      "// app",
    );
  });
});
