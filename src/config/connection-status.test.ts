import { describe, expect, test } from "bun:test";
import { checkConnectionReachable } from "./connection-status";
import type { ConnectionProfile } from "../types";

const baseConnection: ConnectionProfile = {
  id: "local-qdrant",
  name: "local-qdrant",
  provider: "qdrant",
  url: "http://localhost:6333",
  description: "test",
  source: "cli",
};

function stubFetch(capture: { request?: Request }): typeof fetch {
  return (async (input: Request | string | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input.toString(), init);
    capture.request = request;
    return new Response(null, { status: 200 });
  }) as unknown as typeof fetch;
}

describe("checkConnectionReachable", () => {
  test("sends request without api-key header for self-hosted connections", async () => {
    const capture: { request?: Request } = {};
    const status = await checkConnectionReachable(baseConnection, stubFetch(capture));

    expect(status).toBe("reachable");
    expect(capture.request?.headers.get("api-key")).toBeNull();
  });

  test("sends api-key header when apiKey is set", async () => {
    const capture: { request?: Request } = {};
    const status = await checkConnectionReachable(
      { ...baseConnection, apiKey: "sk-cloud-123" },
      stubFetch(capture),
    );

    expect(status).toBe("reachable");
    expect(capture.request?.headers.get("api-key")).toBe("sk-cloud-123");
  });

  test("local chroma with url pings /api/v2/heartbeat", async () => {
    const capture: { request?: Request } = {};
    await checkConnectionReachable(
      {
        ...baseConnection,
        id: "chroma-local",
        name: "chroma-local",
        provider: "chroma",
        url: "http://localhost:8000",
      },
      stubFetch(capture),
    );
    expect(capture.request?.url).toBe("http://localhost:8000/api/v2/heartbeat");
    expect(capture.request?.headers.get("x-chroma-token")).toBeNull();
  });

  test("chroma cloud pings api.trychroma.com with token header", async () => {
    const capture: { request?: Request } = {};
    const status = await checkConnectionReachable(
      {
        ...baseConnection,
        id: "chroma-cloud",
        name: "chroma-cloud",
        provider: "chroma",
        url: undefined,
        apiKey: "ck-secret",
      },
      stubFetch(capture),
    );
    expect(status).toBe("reachable");
    expect(capture.request?.url).toBe("https://api.trychroma.com/api/v2/heartbeat");
    expect(capture.request?.headers.get("x-chroma-token")).toBe("ck-secret");
  });

  test("chroma with no url and no api key returns unknown", async () => {
    const capture: { request?: Request } = {};
    const status = await checkConnectionReachable(
      {
        ...baseConnection,
        id: "chroma-bare",
        name: "chroma-bare",
        provider: "chroma",
        url: undefined,
      },
      stubFetch(capture),
    );
    expect(status).toBe("unknown");
    expect(capture.request).toBeUndefined();
  });

  test("returns unreachable on network error", async () => {
    const failing: typeof fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;

    const status = await checkConnectionReachable(baseConnection, failing);

    expect(status).toBe("unreachable");
  });
});
