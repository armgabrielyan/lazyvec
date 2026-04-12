import { describe, expect, test } from "bun:test";
import { QdrantAdapter, qdrantCapabilities } from "./qdrant";
import type { QdrantClientLike } from "./qdrant-client";
import type { ConnectionProfile } from "../types";

const localConnection: ConnectionProfile = {
  id: "local-qdrant",
  name: "local-qdrant",
  provider: "qdrant",
  url: "http://localhost:6333",
  description: "test connection",
  source: "cli",
};

function createClient(overrides: Partial<QdrantClientLike> = {}): QdrantClientLike {
  return {
    getCollections: async () => ({
      collections: [{ name: "rag_chunks" }, { name: "products" }],
    }),
    getCollection: async (collectionName: string) => ({
      status: "green",
      points_count: collectionName === "rag_chunks" ? 1240 : 890,
      config: {
        params: {
          vectors: {
            size: collectionName === "rag_chunks" ? 1536 : 768,
            distance: collectionName === "rag_chunks" ? "Cosine" : "Dot",
          },
        },
      },
    }),
    scroll: async () => ({
      points: [
        {
          id: "doc-a8f3c2",
          payload: {
            source: "wiki",
            chunk_index: 3,
          },
        },
      ],
      next_page_offset: "next-offset",
    }),
    retrieve: async () => [
      {
        id: "doc-a8f3c2",
        payload: {
          source: "wiki",
        },
        vector: [0.0234, -0.0891, 0.1247],
      },
    ],
    ...overrides,
  };
}

describe("QdrantAdapter", () => {
  test("declares the read-only v0.1 capabilities", () => {
    expect(qdrantCapabilities).toEqual({
      listCollections: true,
      describeCollection: true,
      listRecords: true,
      getRecord: true,
      includeVectorsInList: false,
      metadataFilter: false,
      namespaces: false,
      searchByVector: false,
      searchByText: false,
      deleteRecords: false,
    });
  });

  test("checks health with measured latency", async () => {
    const client = createClient();
    const ticks = [100, 108];
    const adapter = new QdrantAdapter({
      client,
      now: () => ticks.shift() ?? 108,
    });

    await adapter.connect(localConnection);

    await expect(adapter.healthCheck()).resolves.toEqual({
      connected: true,
      latencyMs: 8,
      provider: "qdrant",
    });
  });

  test("lists collections with normalized dimensions, counts, metrics, and status", async () => {
    const adapter = new QdrantAdapter({ client: createClient() });

    await adapter.connect(localConnection);

    await expect(adapter.listCollections()).resolves.toEqual([
      {
        name: "rag_chunks",
        dimensions: 1536,
        count: 1240,
        metric: "cosine",
        provider: "qdrant",
      },
      {
        name: "products",
        dimensions: 768,
        count: 890,
        metric: "dotproduct",
        provider: "qdrant",
      },
    ]);
  });

  test("describes a collection and keeps raw provider config", async () => {
    const adapter = new QdrantAdapter({ client: createClient() });

    await adapter.connect(localConnection);

    await expect(adapter.describeCollection("rag_chunks")).resolves.toEqual({
      name: "rag_chunks",
      dimensions: 1536,
      count: 1240,
      metric: "cosine",
      provider: "qdrant",
      status: "ready",
      config: {
        params: {
          vectors: {
            size: 1536,
            distance: "Cosine",
          },
        },
      },
    });
  });

  test("lists records without fetching vectors by default", async () => {
    let scrollRequest: unknown = null;
    const adapter = new QdrantAdapter({
      client: createClient({
        scroll: async (_collection, request) => {
          scrollRequest = request;
          return {
            points: [
              {
                id: 42,
                payload: {
                  source: "wiki",
                },
              },
            ],
            next_page_offset: 99,
          };
        },
      }),
    });

    await adapter.connect(localConnection);

    await expect(
      adapter.listRecords("rag_chunks", {
        limit: 50,
        cursor: "10",
      }),
    ).resolves.toEqual({
      records: [
        {
          id: "42",
          metadata: {
            source: "wiki",
          },
          vector: null,
        },
      ],
      nextCursor: "99",
    });

    expect(scrollRequest).toEqual({
      limit: 50,
      offset: "10",
      with_payload: true,
      with_vector: false,
    });
  });

  test("fetches one record with vector for the inspector", async () => {
    const adapter = new QdrantAdapter({ client: createClient() });

    await adapter.connect(localConnection);

    await expect(adapter.getRecord("rag_chunks", "doc-a8f3c2")).resolves.toEqual({
      id: "doc-a8f3c2",
      metadata: {
        source: "wiki",
      },
      vector: [0.0234, -0.0891, 0.1247],
    });
  });

  test("fails clearly when a requested record is missing", async () => {
    const adapter = new QdrantAdapter({
      client: createClient({
        retrieve: async () => [],
      }),
    });

    await adapter.connect(localConnection);

    await expect(adapter.getRecord("rag_chunks", "missing")).rejects.toThrow(
      'Record "missing" was not found in collection "rag_chunks"',
    );
  });
});
