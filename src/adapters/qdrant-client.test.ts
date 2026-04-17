import { describe, expect, test } from "bun:test";
import { buildQdrantClientOptions, createQdrantClient } from "./qdrant-client";
import type { ConnectionProfile } from "../types";

const baseConnection: ConnectionProfile = {
  id: "local-qdrant",
  name: "local-qdrant",
  provider: "qdrant",
  url: "http://localhost:6333",
  description: "test",
  source: "cli",
};

describe("createQdrantClient", () => {
  test("creates an SDK-backed client facade", () => {
    const client = createQdrantClient(baseConnection);

    expect(typeof client.getCollections).toBe("function");
    expect(typeof client.getCollection).toBe("function");
    expect(typeof client.scroll).toBe("function");
    expect(typeof client.retrieve).toBe("function");
  });
});

describe("buildQdrantClientOptions", () => {
  test("returns url without apiKey for self-hosted connections", () => {
    expect(buildQdrantClientOptions(baseConnection)).toEqual({
      url: "http://localhost:6333",
      checkCompatibility: false,
    });
  });

  test("forwards apiKey when present", () => {
    expect(buildQdrantClientOptions({ ...baseConnection, apiKey: "sk-123" })).toEqual({
      url: "http://localhost:6333",
      apiKey: "sk-123",
      checkCompatibility: false,
    });
  });
});
