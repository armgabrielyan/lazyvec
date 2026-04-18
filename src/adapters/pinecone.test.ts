import { describe, expect, test } from "bun:test";
import { PineconeAdapter, pineconeCapabilities } from "./pinecone";
import type {
  PineconeClientLike,
  PineconeIndexStats,
  PineconeIndexSummary,
  PineconeListPage,
  PineconeQueryMatch,
  PineconeRecordShape,
} from "./pinecone-client";
import type { ConnectionProfile } from "../types";

const connection: ConnectionProfile = {
  id: "cloud-pinecone",
  name: "cloud-pinecone",
  provider: "pinecone",
  apiKey: "test-key",
  description: "test connection",
  source: "cli",
};

const serverlessIndex: PineconeIndexSummary = {
  name: "movies",
  host: "movies-abc123.svc.apw5.pinecone.io",
  dimension: 1536,
  metric: "cosine",
  isServerless: true,
  status: "ready",
};

const podIndex: PineconeIndexSummary = {
  name: "legacy-pod",
  host: "legacy-pod-xyz.svc.pinecone.io",
  dimension: 384,
  metric: "dotproduct",
  isServerless: false,
  status: "ready",
};

interface ClientCalls {
  listIndexes: number;
  describeIndex: string[];
  describeIndexStats: string[];
  listPaginatedIds: Array<{ host: string; namespace: string; limit?: number; prefix?: string; paginationToken?: string }>;
  fetch: Array<{ host: string; namespace: string; ids: string[] }>;
  query: Array<{ host: string; namespace: string; vector: number[]; topK: number; filter?: object }>;
  deleteMany: Array<{ host: string; namespace: string; ids: string[] }>;
}

function createClient(overrides: Partial<PineconeClientLike> = {}): {
  client: PineconeClientLike;
  calls: ClientCalls;
} {
  const calls: ClientCalls = {
    listIndexes: 0,
    describeIndex: [],
    describeIndexStats: [],
    listPaginatedIds: [],
    fetch: [],
    query: [],
    deleteMany: [],
  };

  const stats: PineconeIndexStats = {
    dimension: 1536,
    indexFullness: 0.02,
    totalRecordCount: 1250,
    namespaces: [
      { name: "", count: 1000 },
      { name: "prod", count: 250 },
    ],
  };

  const client: PineconeClientLike = {
    listIndexes: async () => {
      calls.listIndexes += 1;
      return [serverlessIndex, podIndex];
    },
    describeIndex: async (name: string) => {
      calls.describeIndex.push(name);
      if (name === serverlessIndex.name) return serverlessIndex;
      if (name === podIndex.name) return podIndex;
      throw new Error(`unknown index ${name}`);
    },
    describeIndexStats: async (host: string) => {
      calls.describeIndexStats.push(host);
      return stats;
    },
    listPaginatedIds: async (host, namespace, opts): Promise<PineconeListPage> => {
      calls.listPaginatedIds.push({ host, namespace, ...opts });
      return { ids: ["rec-1", "rec-2"], nextToken: "token-2" };
    },
    fetch: async (host, namespace, ids): Promise<PineconeRecordShape[]> => {
      calls.fetch.push({ host, namespace, ids });
      return ids.map((id) => ({
        id,
        metadata: { title: `title-${id}` },
        values: [0.1, 0.2, 0.3],
      }));
    },
    query: async (host, namespace, opts): Promise<PineconeQueryMatch[]> => {
      calls.query.push({ host, namespace, ...opts });
      return [
        {
          record: { id: "rec-9", metadata: { title: "match" } },
          score: 0.97,
        },
      ];
    },
    deleteMany: async (host, namespace, ids) => {
      calls.deleteMany.push({ host, namespace, ids });
    },
    ...overrides,
  };

  return { client, calls };
}

function createAdapter(overrides: Partial<PineconeClientLike> = {}, now?: () => number) {
  const { client, calls } = createClient(overrides);
  const adapter = new PineconeAdapter({ client, ...(now ? { now } : {}) });
  return { adapter, calls };
}

describe("PineconeAdapter", () => {
  test("declares the expected capability flags", () => {
    expect(pineconeCapabilities).toEqual({
      listCollections: true,
      describeCollection: true,
      listRecords: true,
      getRecord: true,
      includeVectorsInList: false,
      metadataFilter: false,
      namespaces: true,
      searchByVector: true,
      searchByText: false,
      deleteRecords: true,
      getCollectionStats: true,
    });
  });

  test("connect rejects non-pinecone profiles", async () => {
    const adapter = new PineconeAdapter({ clientFactory: () => ({} as PineconeClientLike) });
    await expect(adapter.connect({ ...connection, provider: "qdrant" })).rejects.toThrow(
      /cannot connect to provider/,
    );
  });

  test("healthCheck measures latency via listIndexes", async () => {
    const ticks = [100, 142];
    const { adapter } = createAdapter({}, () => ticks.shift() ?? 0);
    await adapter.connect(connection);
    const result = await adapter.healthCheck();
    expect(result).toEqual({ connected: true, latencyMs: 42, provider: "pinecone" });
  });

  test("listCollections flattens index×namespace rows", async () => {
    const { adapter } = createAdapter();
    await adapter.connect(connection);
    const rows = await adapter.listCollections();
    expect(rows).toEqual([
      {
        name: "movies",
        dimensions: 1536,
        count: 1000,
        metric: "cosine",
        provider: "pinecone",
      },
      {
        name: "movies/prod",
        dimensions: 1536,
        count: 250,
        metric: "cosine",
        provider: "pinecone",
      },
      {
        name: "legacy-pod",
        dimensions: 384,
        count: 1000,
        metric: "dotproduct",
        provider: "pinecone",
      },
      {
        name: "legacy-pod/prod",
        dimensions: 384,
        count: 250,
        metric: "dotproduct",
        provider: "pinecone",
      },
    ]);
  });

  test("listRecords returns fetched records using paginated ids for default namespace", async () => {
    const { adapter, calls } = createAdapter();
    await adapter.connect(connection);
    const page = await adapter.listRecords("movies", { limit: 10 });
    expect(page.nextCursor).toBe("token-2");
    expect(page.records.map((r) => r.id)).toEqual(["rec-1", "rec-2"]);
    expect(calls.listPaginatedIds).toEqual([
      { host: serverlessIndex.host, namespace: "", limit: 10 },
    ]);
    expect(calls.fetch).toEqual([
      { host: serverlessIndex.host, namespace: "", ids: ["rec-1", "rec-2"] },
    ]);
  });

  test("listRecords with encoded namespace targets that namespace", async () => {
    const { adapter, calls } = createAdapter();
    await adapter.connect(connection);
    await adapter.listRecords("movies/prod", { limit: 5, cursor: "token-1" });
    expect(calls.listPaginatedIds[0]).toEqual({
      host: serverlessIndex.host,
      namespace: "prod",
      limit: 5,
      paginationToken: "token-1",
    });
  });

  test("listRecords with id filter fetches those ids directly", async () => {
    const { adapter, calls } = createAdapter();
    await adapter.connect(connection);
    const page = await adapter.listRecords("movies", {
      limit: 10,
      filter: [{ type: "id", value: "rec-42" }],
    });
    expect(page.records.map((r) => r.id)).toEqual(["rec-42"]);
    expect(page.nextCursor).toBeUndefined();
    expect(calls.listPaginatedIds).toEqual([]);
    expect(calls.fetch).toEqual([
      { host: serverlessIndex.host, namespace: "", ids: ["rec-42"] },
    ]);
  });

  test("listRecords rejects metadata filters", async () => {
    const { adapter } = createAdapter();
    await adapter.connect(connection);
    await expect(
      adapter.listRecords("movies", {
        limit: 10,
        filter: [{ type: "field", key: "status", operator: "eq", value: "ok" }],
      }),
    ).rejects.toThrow(/metadata filter/);
  });

  test("listRecords rejects pod-based indexes", async () => {
    const { adapter } = createAdapter();
    await adapter.connect(connection);
    await expect(adapter.listRecords("legacy-pod", { limit: 10 })).rejects.toThrow(/pod-based/);
  });

  test("getRecord fetches single id", async () => {
    const { adapter, calls } = createAdapter();
    await adapter.connect(connection);
    const record = await adapter.getRecord("movies/prod", "rec-7");
    expect(record.id).toBe("rec-7");
    expect(record.vector).toEqual([0.1, 0.2, 0.3]);
    expect(calls.fetch).toEqual([
      { host: serverlessIndex.host, namespace: "prod", ids: ["rec-7"] },
    ]);
  });

  test("getRecord throws when record is missing", async () => {
    const { adapter } = createAdapter({ fetch: async () => [] });
    await adapter.connect(connection);
    await expect(adapter.getRecord("movies", "missing")).rejects.toThrow(/not found/);
  });

  test("searchByVector passes vector and topK to query", async () => {
    const { adapter, calls } = createAdapter();
    await adapter.connect(connection);
    const results = await adapter.searchByVector("movies", { vector: [1, 2, 3], limit: 5 });
    expect(results).toEqual([
      {
        record: { id: "rec-9", metadata: { title: "match" }, vector: null },
        score: 0.97,
      },
    ]);
    expect(calls.query).toEqual([
      { host: serverlessIndex.host, namespace: "", vector: [1, 2, 3], topK: 5 },
    ]);
  });

  test("deleteRecords forwards ids with namespace", async () => {
    const { adapter, calls } = createAdapter();
    await adapter.connect(connection);
    const result = await adapter.deleteRecords("movies/prod", ["rec-1", "rec-2"]);
    expect(result).toEqual({ deleted: 2 });
    expect(calls.deleteMany).toEqual([
      { host: serverlessIndex.host, namespace: "prod", ids: ["rec-1", "rec-2"] },
    ]);
  });

  test("deleteRecords short-circuits on empty ids", async () => {
    const { adapter, calls } = createAdapter();
    await adapter.connect(connection);
    const result = await adapter.deleteRecords("movies", []);
    expect(result).toEqual({ deleted: 0 });
    expect(calls.deleteMany).toEqual([]);
  });

  test("getCollectionStats returns namespace list with default label", async () => {
    const { adapter } = createAdapter();
    await adapter.connect(connection);
    const stats = await adapter.getCollectionStats("movies/prod");
    expect(stats).toEqual({
      status: "ready",
      counts: { points: 250 },
      vectorConfig: { dimensions: 1536, metric: "cosine" },
      namespaces: [
        { name: "(default)", count: 1000 },
        { name: "prod", count: 250 },
      ],
    });
  });

  test("describeCollection uses namespace count when namespace matches", async () => {
    const { adapter } = createAdapter();
    await adapter.connect(connection);
    const details = await adapter.describeCollection("movies/prod");
    expect(details).toMatchObject({
      name: "movies/prod",
      dimensions: 1536,
      count: 250,
      metric: "cosine",
      status: "ready",
    });
    expect(details.config).toEqual({
      host: serverlessIndex.host,
      namespace: "prod",
      serverless: true,
    });
  });

  test("describeCollection for unknown namespace falls back to total count", async () => {
    const { adapter } = createAdapter();
    await adapter.connect(connection);
    const details = await adapter.describeCollection("movies/staging");
    expect(details.count).toBe(1250);
  });
});
