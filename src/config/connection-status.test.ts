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

  test("returns unreachable on network error", async () => {
    const failing: typeof fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;

    const status = await checkConnectionReachable(baseConnection, failing);

    expect(status).toBe("unreachable");
  });
});
