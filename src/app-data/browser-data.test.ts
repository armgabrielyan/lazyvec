import { describe, expect, test } from "bun:test";
import { loadCollectionRecords, loadInitialBrowserData, loadNextCollectionRecords, loadRecordDetails, searchSimilarRecords } from "./browser-data";
import type { AdapterCapabilities, HealthStatus, ListOptions, VectorDBAdapter } from "../adapters/types";

const capabilities: AdapterCapabilities = {
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
};

class FakeAdapter implements VectorDBAdapter {
  readonly provider = "qdrant" as const;
  readonly capabilities = capabilities;
  calls: string[] = [];
  listRecordsOptions: ListOptions | null = null;
  getRecordCalls: Array<{ collection: string; id: string }> = [];

  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {}

  async healthCheck(): Promise<HealthStatus> {
    this.calls.push("healthCheck");
    return { connected: true, latencyMs: 4, provider: "qdrant" };
  }

  async listCollections() {
    this.calls.push("listCollections");
    return [
      {
        name: "rag_chunks",
        dimensions: 1536,
        count: 1240,
        metric: "cosine" as const,
        provider: "qdrant" as const,
      },
    ];
  }

  async describeCollection(name: string) {
    return {
      name,
      dimensions: 1536,
      count: 1240,
      metric: "cosine" as const,
      provider: "qdrant" as const,
      status: "ready" as const,
      config: {},
    };
  }

  async listRecords(collection: string, opts: ListOptions) {
    this.calls.push(`listRecords:${collection}`);
    this.listRecordsOptions = opts;
    return {
      records: [
        {
          id: "doc-a8f3c2",
          metadata: { source: "wiki" },
          vector: null,
        },
      ],
      nextCursor: "next",
    };
  }

  async getRecord(collection: string, id: string) {
    this.getRecordCalls.push({ collection, id });
    return {
      id,
      metadata: { source: "wiki" },
      vector: [0.1, 0.2, 0.3],
    };
  }

  async searchByVector(_collection: string, opts: { vector: number[]; limit: number }) {
    this.calls.push("searchByVector");
    return [
      { record: { id: "similar-1", metadata: { source: "wiki" }, vector: null }, score: 0.95 },
      { record: { id: "similar-2", metadata: { source: "blog" }, vector: null }, score: 0.82 },
    ].slice(0, opts.limit);
  }
}

describe("browser data loading", () => {
  test("loads initial collections and first record page without vectors", async () => {
    const adapter = new FakeAdapter();

    await expect(loadInitialBrowserData(adapter, { pageSize: 25 })).resolves.toEqual({
      health: { connected: true, latencyMs: 4, provider: "qdrant" },
      collections: [
        {
          name: "rag_chunks",
          dimensions: 1536,
          count: 1240,
          metric: "cosine",
          provider: "qdrant",
        },
      ],
      records: [
        {
          id: "doc-a8f3c2",
          metadata: { source: "wiki" },
          vector: null,
        },
      ],
      recordCursor: "next",
    });
    expect(adapter.calls).toEqual(["healthCheck", "listCollections", "listRecords:rag_chunks"]);
    expect(adapter.listRecordsOptions).toEqual({
      limit: 25,
      includeVectors: false,
    });
    expect(adapter.getRecordCalls).toEqual([]);
  });

  test("does not list records when there are no collections", async () => {
    const adapter = new FakeAdapter();
    adapter.listCollections = async () => {
      adapter.calls.push("listCollections");
      return [];
    };

    await expect(loadInitialBrowserData(adapter, { pageSize: 25 })).resolves.toEqual({
      health: { connected: true, latencyMs: 4, provider: "qdrant" },
      collections: [],
      records: [],
    });
    expect(adapter.calls).toEqual(["healthCheck", "listCollections"]);
  });

  test("loads collection records without vectors", async () => {
    const adapter = new FakeAdapter();

    await loadCollectionRecords(adapter, "rag_chunks", { pageSize: 10 });

    expect(adapter.listRecordsOptions).toEqual({
      limit: 10,
      includeVectors: false,
    });
  });

  test("loads the next collection record page with the cursor and without vectors", async () => {
    const adapter = new FakeAdapter();

    await loadNextCollectionRecords(adapter, "rag_chunks", "next", { pageSize: 10 });

    expect(adapter.listRecordsOptions).toEqual({
      limit: 10,
      cursor: "next",
      includeVectors: false,
    });
  });

  test("searches for similar records by vector", async () => {
    const adapter = new FakeAdapter();

    const results = await searchSimilarRecords(adapter, "rag_chunks", [0.1, 0.2, 0.3], 10);

    expect(results).toEqual([
      { record: { id: "similar-1", metadata: { source: "wiki" }, vector: null }, score: 0.95 },
      { record: { id: "similar-2", metadata: { source: "blog" }, vector: null }, score: 0.82 },
    ]);
    expect(adapter.calls).toContain("searchByVector");
  });

  test("loads record details for the inspector", async () => {
    const adapter = new FakeAdapter();

    await expect(loadRecordDetails(adapter, "rag_chunks", "doc-a8f3c2")).resolves.toEqual({
      id: "doc-a8f3c2",
      metadata: { source: "wiki" },
      vector: [0.1, 0.2, 0.3],
    });
    expect(adapter.getRecordCalls).toEqual([{ collection: "rag_chunks", id: "doc-a8f3c2" }]);
  });
});
