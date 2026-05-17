/**
 * Minimal HTTP client seam. Source adapters depend on this interface only, so
 * they stay Forge-free and unit-testable. Production wires Forge's egress
 * fetch (P6); tests inject a canned client.
 */
export interface HttpResponse {
  status: number;
  ok: boolean;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

export interface HttpClient {
  get(url: string, headers?: Record<string, string>): Promise<HttpResponse>;
}

/** Wrap any WHATWG-style fetch (Forge egress fetch, global fetch) as HttpClient. */
export function fetchHttpClient(
  fetchImpl: (
    url: string,
    init?: { headers?: Record<string, string> },
  ) => Promise<{
    status: number;
    ok: boolean;
    text(): Promise<string>;
    json(): Promise<unknown>;
  }>,
): HttpClient {
  return {
    async get(url, headers) {
      const r = await fetchImpl(url, headers ? { headers } : undefined);
      return {
        status: r.status,
        ok: r.ok,
        text: () => r.text(),
        json: () => r.json(),
      };
    },
  };
}
