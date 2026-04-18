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
    search: async () => [],
    delete: async () => ({ status: "completed" }),
    getCollectionAliases: async () => ({ aliases: [] }),
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
      metadataFilter: true,
      namespaces: false,
      searchByVector: true,
      searchByText: false,
      deleteRecords: true,
      getCollectionStats: true,
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
      offset: 10,
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

  test("retrieves numeric point IDs as numbers after display normalization", async () => {
    let retrieveRequest: unknown = null;
    const adapter = new QdrantAdapter({
      client: createClient({
        retrieve: async (_collection, request) => {
          retrieveRequest = request;
          return [
            {
              id: 42,
              payload: {
                source: "wiki",
              },
              vector: [0.1, 0.2, 0.3],
            },
          ];
        },
      }),
    });

    await adapter.connect(localConnection);

    await expect(adapter.getRecord("rag_chunks", "42")).resolves.toEqual({
      id: "42",
      metadata: {
        source: "wiki",
      },
      vector: [0.1, 0.2, 0.3],
    });
    expect(retrieveRequest).toEqual({
      ids: [42],
      with_payload: true,
      with_vector: true,
    });
  });

  test("searches by vector and returns scored results", async () => {
    let searchRequest: unknown = null;
    const adapter = new QdrantAdapter({
      client: createClient({
        search: async (_collection, request) => {
          searchRequest = request;
          return [
            { id: "doc-1", payload: { source: "wiki" }, score: 0.95 },
            { id: 42, payload: { source: "blog" }, score: 0.82 },
          ];
        },
      }),
    });

    await adapter.connect(localConnection);

    await expect(
      adapter.searchByVector("rag_chunks", { vector: [0.1, 0.2, 0.3], limit: 10 }),
    ).resolves.toEqual([
      { record: { id: "doc-1", metadata: { source: "wiki" }, vector: null }, score: 0.95 },
      { record: { id: "42", metadata: { source: "blog" }, vector: null }, score: 0.82 },
    ]);
    expect(searchRequest).toEqual({
      vector: [0.1, 0.2, 0.3],
      limit: 10,
      with_payload: true,
      with_vector: false,
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

  test("builds collection stats from getCollection plus aliases", async () => {
    const adapter = new QdrantAdapter({
      client: createClient({
        getCollection: async () => ({
          status: "green",
          optimizer_status: "ok",
          points_count: 18820,
          indexed_vectors_count: 18828,
          segments_count: 2,
          config: {
            params: {
              vectors: { size: 384, distance: "Cosine", on_disk: false },
              shard_number: 1,
              replication_factor: 2,
              write_consistency_factor: 1,
              on_disk_payload: true,
            },
            hnsw_config: {
              m: 16,
              ef_construct: 100,
              full_scan_threshold: 10000,
              on_disk: false,
            },
            quantization_config: {
              scalar: { type: "int8", quantile: 0.99, always_ram: true },
            },
          },
          payload_schema: {
            text: {
              data_type: "text",
              points: 18725,
              params: { tokenizer: "prefix" },
            },
            sections: {
              data_type: "keyword",
              points: 18820,
            },
          },
        }),
        getCollectionAliases: async () => ({
          aliases: [
            { alias_name: "current", collection_name: "rag_chunks" },
            { alias_name: "live", collection_name: "rag_chunks" },
          ],
        }),
      }),
    });

    await adapter.connect(localConnection);

    await expect(adapter.getCollectionStats("rag_chunks")).resolves.toEqual({
      status: "ready",
      optimizerStatus: { ok: true },
      counts: { points: 18820, indexedVectors: 18828, segments: 2 },
      vectorConfig: { dimensions: 384, metric: "cosine", onDisk: false },
      indexConfig: {
        kind: "hnsw",
        m: 16,
        efConstruct: 100,
        fullScanThreshold: 10000,
        onDisk: false,
      },
      quantization: {
        kind: "scalar",
        details: { type: "int8", quantile: 0.99, always_ram: true },
      },
      sharding: {
        shardNumber: 1,
        replicationFactor: 2,
        writeConsistencyFactor: 1,
      },
      payloadIndexes: [
        { field: "text", dataType: "text", indexedPoints: 18725 },
        { field: "sections", dataType: "keyword", indexedPoints: 18820 },
      ],
      aliases: ["current", "live"],
    });
  });

  test("surfaces optimizer warnings as messages", async () => {
    const adapter = new QdrantAdapter({
      client: createClient({
        getCollection: async () => ({
          status: "yellow",
          optimizer_status: { error: "segment overflow" },
          points_count: 10,
          config: {
            params: { vectors: { size: 4, distance: "Cosine" } },
          },
        }),
      }),
    });

    await adapter.connect(localConnection);

    const stats = await adapter.getCollectionStats("rag_chunks");
    expect(stats.status).toBe("initializing");
    expect(stats.optimizerStatus).toEqual({ ok: false, message: "segment overflow" });
  });

  test("gracefully handles a sparse getCollection response", async () => {
    const adapter = new QdrantAdapter({
      client: createClient({
        getCollection: async () => ({
          status: "green",
          points_count: 0,
          config: {
            params: { vectors: { size: 8, distance: "Euclid" } },
          },
        }),
        getCollectionAliases: async () => ({ aliases: [] }),
      }),
    });

    await adapter.connect(localConnection);

    await expect(adapter.getCollectionStats("rag_chunks")).resolves.toEqual({
      status: "ready",
      counts: { points: 0 },
      vectorConfig: { dimensions: 8, metric: "euclidean" },
      aliases: [],
    });
  });

  test("continues when the aliases endpoint fails", async () => {
    const adapter = new QdrantAdapter({
      client: createClient({
        getCollectionAliases: async () => {
          throw new Error("403 forbidden");
        },
      }),
    });

    await adapter.connect(localConnection);

    const stats = await adapter.getCollectionStats("rag_chunks");
    expect(stats.aliases).toBeUndefined();
    expect(stats.counts.points).toBe(1240);
  });

  test("deletes records by ID", async () => {
    let deleteRequest: unknown = null;
    const adapter = new QdrantAdapter({
      client: createClient({
        delete: async (_collection, request) => {
          deleteRequest = request;
          return { status: "completed" };
        },
      }),
    });

    await adapter.connect(localConnection);

    await expect(
      adapter.deleteRecords("rag_chunks", ["doc-1", "42"]),
    ).resolves.toEqual({ deleted: 2 });
    expect(deleteRequest).toEqual({ points: ["doc-1", 42] });
  });
});
