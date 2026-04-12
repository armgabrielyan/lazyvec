import { describe, expect, test } from "bun:test";
import { createQdrantClient } from "./qdrant-client";

describe("createQdrantClient", () => {
  test("creates an SDK-backed client facade", () => {
    const client = createQdrantClient({
      id: "local-qdrant",
      name: "local-qdrant",
      provider: "qdrant",
      url: "http://localhost:6333",
      description: "test",
      source: "cli",
    });

    expect(typeof client.getCollections).toBe("function");
    expect(typeof client.getCollection).toBe("function");
    expect(typeof client.scroll).toBe("function");
    expect(typeof client.retrieve).toBe("function");
  });
});
