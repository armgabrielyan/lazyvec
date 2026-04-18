import { describe, expect, test } from "bun:test";
import { ChromaAdapter, chromaCapabilities } from "./chroma";
import type {
  ChromaClientLike,
  ChromaCollectionSummary,
  ChromaGetOptions,
  ChromaQueryOptions,
  ChromaRecord,
} from "./chroma-client";
import type { ConnectionProfile } from "../types";

const connection: ConnectionProfile = {
  id: "local-chroma",
  name: "local-chroma",
  provider: "chroma",
  url: "http://localhost:8000",
  description: "test connection",
  source: "cli",
};

const moviesSummary: ChromaCollectionSummary = {
  id: "movies-id",
  name: "movies",
  metric: "cosine",
  configuration: { hnsw: { space: "cosine" } },
  metadata: {},
};

const booksSummary: ChromaCollectionSummary = {
  id: "books-id",
  name: "books",
  metric: "euclidean",
  configuration: {},
  metadata: { "hnsw:space": "l2" },
};

interface ClientCalls {
  heartbeat: number;
  listCollections: number;
  getCollectionSummary: string[];
  countRecords: string[];
  getRecords: Array<{ name: string; opts: ChromaGetOptions }>;
  queryRecords: Array<{ name: string; opts: ChromaQueryOptions }>;
  deleteRecords: Array<{ name: string; ids: string[] }>;
}

function createClient(overrides: Partial<ChromaClientLike> = {}): {
  client: ChromaClientLike;
  calls: ClientCalls;
} {
  const calls: ClientCalls = {
    heartbeat: 0,
    listCollections: 0,
    getCollectionSummary: [],
    countRecords: [],
    getRecords: [],
    queryRecords: [],
    deleteRecords: [],
  };

  const baseRecords: ChromaRecord[] = [
    { id: "rec-1", metadata: { title: "a" }, embedding: [0.1, 0.2, 0.3], document: "doc-a" },
    { id: "rec-2", metadata: { title: "b" }, embedding: [0.4, 0.5, 0.6], document: null },
  ];

  const client: ChromaClientLike = {
    heartbeat: async () => {
      calls.heartbeat += 1;
    },
    listCollections: async () => {
      calls.listCollections += 1;
      return [moviesSummary, booksSummary];
    },
    getCollectionSummary: async (name) => {
      calls.getCollectionSummary.push(name);
      if (name === moviesSummary.name) return moviesSummary;
      if (name === booksSummary.name) return booksSummary;
      throw new Error(`unknown collection ${name}`);
    },
    countRecords: async (name) => {
      calls.countRecords.push(name);
      if (name === moviesSummary.name) return 2;
      if (name === booksSummary.name) return 5;
      return 0;
    },
    getRecords: async (name, opts) => {
      calls.getRecords.push({ name, opts });
      if (opts.ids) {
        return opts.ids.map((id) => {
          const match = baseRecords.find((record) => record.id === id);
          return match ?? { id, metadata: { picked: id }, embedding: opts.includeEmbeddings ? [9, 9, 9] : null, document: null };
        });
      }
      return opts.includeEmbeddings
        ? baseRecords
        : baseRecords.map((record) => ({ ...record, embedding: null }));
    },
    queryRecords: async (name, opts) => {
      calls.queryRecords.push({ name, opts });
      return [
        {
          record: { id: "rec-9", metadata: { title: "match" }, embedding: null, document: null },
          distance: 0.12,
        },
      ];
    },
    deleteRecords: async (name, ids) => {
      calls.deleteRecords.push({ name, ids });
    },
    ...overrides,
  };

  return { client, calls };
}

function createAdapter(overrides: Partial<ChromaClientLike> = {}, now?: () => number) {
  const { client, calls } = createClient(overrides);
  const adapter = new ChromaAdapter({ client, ...(now ? { now } : {}) });
  return { adapter, calls };
}

describe("ChromaAdapter", () => {
  test("declares expected capability flags", () => {
    expect(chromaCapabilities).toEqual({
      listCollections: true,
      describeCollection: true,
      listRecords: true,
      getRecord: true,
      includeVectorsInList: true,
      metadataFilter: true,
      namespaces: false,
      searchByVector: true,
      searchByText: false,
      deleteRecords: true,
      getCollectionStats: true,
    });
  });

  test("connect rejects non-chroma profiles", async () => {
    const adapter = new ChromaAdapter({ clientFactory: () => ({} as ChromaClientLike) });
    await expect(adapter.connect({ ...connection, provider: "qdrant" })).rejects.toThrow(
      /cannot connect to provider/,
    );
  });

  test("healthCheck measures latency via heartbeat", async () => {
    const ticks = [100, 137];
    const { adapter } = createAdapter({}, () => ticks.shift() ?? 0);
    await adapter.connect(connection);
    const result = await adapter.healthCheck();
    expect(result).toEqual({ connected: true, latencyMs: 37, provider: "chroma" });
  });

  test("listCollections returns one row per chroma collection with dimensions", async () => {
    const { adapter } = createAdapter();
    await adapter.connect(connection);
    const rows = await adapter.listCollections();
    expect(rows).toEqual([
      { name: "movies", dimensions: 3, count: 2, metric: "cosine", provider: "chroma" },
      { name: "books", dimensions: 3, count: 5, metric: "euclidean", provider: "chroma" },
    ]);
  });

  test("describeCollection surfaces configuration + metadata in config blob", async () => {
    const { adapter } = createAdapter();
    await adapter.connect(connection);
    const details = await adapter.describeCollection("movies");
    expect(details).toMatchObject({
      name: "movies",
      dimensions: 3,
      count: 2,
      metric: "cosine",
      status: "ready",
      provider: "chroma",
    });
    expect(details.config).toEqual({
      id: moviesSummary.id,
      configuration: moviesSummary.configuration,
      metadata: moviesSummary.metadata,
    });
  });

  test("listRecords paginates with offset cursor", async () => {
    const { adapter, calls } = createAdapter();
    await adapter.connect(connection);

    const first = await adapter.listRecords("movies", { limit: 2 });
    expect(first.records.map((r) => r.id)).toEqual(["rec-1", "rec-2"]);
    expect(first.nextCursor).toBe("2");

    const getRecordsCall = calls.getRecords.find((c) => c.opts.limit === 2 && c.opts.offset === 0);
    expect(getRecordsCall).toBeDefined();

    await adapter.listRecords("movies", { limit: 2, cursor: "2" });
    const secondCall = calls.getRecords.find((c) => c.opts.offset === 2);
    expect(secondCall).toBeDefined();
  });

  test("listRecords with id filter bypasses pagination cursor", async () => {
    const { adapter, calls } = createAdapter();
    await adapter.connect(connection);
    const page = await adapter.listRecords("movies", {
      limit: 10,
      filter: [{ type: "id", value: "rec-42" }],
    });
    expect(page.records.map((r) => r.id)).toEqual(["rec-42"]);
    expect(page.nextCursor).toBeUndefined();
    expect(calls.getRecords[0]?.opts.ids).toEqual(["rec-42"]);
  });

  test("listRecords translates field filters to chroma where", async () => {
    const { adapter, calls } = createAdapter();
    await adapter.connect(connection);
    await adapter.listRecords("movies", {
      limit: 5,
      filter: [
        { type: "field", key: "status", operator: "eq", value: "ok" },
        { type: "field", key: "score", operator: "gt", value: 1 },
      ],
    });
    expect(calls.getRecords[0]?.opts.where).toEqual({
      $and: [{ status: { $eq: "ok" } }, { score: { $gt: 1 } }],
    });
  });

  test("listRecords includeVectors propagates to client", async () => {
    const { adapter, calls } = createAdapter();
    await adapter.connect(connection);
    await adapter.listRecords("movies", { limit: 2, includeVectors: true });
    const call = calls.getRecords.find((c) => c.opts.includeEmbeddings === true && c.opts.limit === 2);
    expect(call).toBeDefined();
  });

  test("listRecords exposes document text under metadata.document", async () => {
    const { adapter } = createAdapter();
    await adapter.connect(connection);
    const page = await adapter.listRecords("movies", { limit: 2, includeVectors: true });
    const first = page.records[0];
    expect(first?.metadata).toEqual({ title: "a", document: "doc-a" });
    expect(first?.vector).toEqual([0.1, 0.2, 0.3]);
  });

  test("getRecord requests embeddings and throws when missing", async () => {
    const { adapter } = createAdapter({
      getRecords: async (_name, opts) => {
        if (opts.ids?.[0] === "rec-1") {
          return [{ id: "rec-1", metadata: { title: "a" }, embedding: [1, 2, 3], document: null }];
        }
        return [];
      },
    });
    await adapter.connect(connection);
    const record = await adapter.getRecord("movies", "rec-1");
    expect(record.vector).toEqual([1, 2, 3]);
    await expect(adapter.getRecord("movies", "missing")).rejects.toThrow(/not found/);
  });

  test("searchByVector passes embedding + nResults and maps distance to score", async () => {
    const { adapter, calls } = createAdapter();
    await adapter.connect(connection);
    const results = await adapter.searchByVector("movies", { vector: [1, 2, 3], limit: 5 });
    expect(results).toEqual([
      {
        record: { id: "rec-9", metadata: { title: "match" }, vector: null },
        score: 0.12,
      },
    ]);
    expect(calls.queryRecords[0]?.opts).toMatchObject({ embedding: [1, 2, 3], nResults: 5 });
  });

  test("deleteRecords forwards ids and short-circuits on empty", async () => {
    const { adapter, calls } = createAdapter();
    await adapter.connect(connection);
    const result = await adapter.deleteRecords("movies", ["rec-1", "rec-2"]);
    expect(result).toEqual({ deleted: 2 });
    expect(calls.deleteRecords[0]).toEqual({ name: "movies", ids: ["rec-1", "rec-2"] });

    const empty = await adapter.deleteRecords("movies", []);
    expect(empty).toEqual({ deleted: 0 });
    expect(calls.deleteRecords.length).toBe(1);
  });

  test("getCollectionStats returns count + vector config", async () => {
    const { adapter } = createAdapter();
    await adapter.connect(connection);
    const stats = await adapter.getCollectionStats("movies");
    expect(stats).toEqual({
      status: "ready",
      counts: { points: 2 },
      vectorConfig: { dimensions: 3, metric: "cosine" },
    });
  });
});
