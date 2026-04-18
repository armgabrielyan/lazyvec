import type { ConnectionProfile } from "../types";
import {
  createChromaClient,
  type ChromaClientFactory,
  type ChromaClientLike,
  type ChromaCollectionSummary,
  type ChromaRecord,
} from "./chroma-client";
import { toChromaFilter } from "./chroma-filter";
import type {
  AdapterCapabilities,
  Collection,
  CollectionDetails,
  CollectionStats,
  HealthStatus,
  ListOptions,
  SearchOptions,
  SearchResult,
  VectorDBAdapter,
  VectorPage,
  VectorRecord,
} from "./types";

export const chromaCapabilities: AdapterCapabilities = {
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
};

interface ChromaAdapterOptions {
  client?: ChromaClientLike;
  clientFactory?: ChromaClientFactory;
  now?: () => number;
}

export class ChromaAdapter implements VectorDBAdapter {
  readonly provider = "chroma" as const;
  readonly capabilities = chromaCapabilities;

  private client: ChromaClientLike | null = null;
  private readonly clientFactory: ChromaClientFactory;
  private readonly now: () => number;
  private readonly dimensionsCache = new Map<string, number>();

  constructor(options: ChromaAdapterOptions = {}) {
    this.client = options.client ?? null;
    this.clientFactory = options.clientFactory ?? createChromaClient;
    this.now = options.now ?? Date.now;
  }

  async connect(config: ConnectionProfile): Promise<void> {
    if (config.provider !== "chroma") {
      throw new Error(`ChromaAdapter cannot connect to provider "${config.provider}"`);
    }

    this.client ??= this.clientFactory(config);
    this.dimensionsCache.clear();
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this.dimensionsCache.clear();
  }

  async healthCheck(): Promise<HealthStatus> {
    const start = this.now();
    await this.requireClient().heartbeat();
    return {
      connected: true,
      latencyMs: this.now() - start,
      provider: this.provider,
    };
  }

  async listCollections(): Promise<Collection[]> {
    const client = this.requireClient();
    const summaries = await client.listCollections();
    return Promise.all(
      summaries.map(async (summary) => ({
        name: summary.name,
        dimensions: await this.resolveDimensions(summary.name),
        count: await client.countRecords(summary.name),
        metric: summary.metric,
        provider: this.provider,
      })),
    );
  }

  async describeCollection(name: string): Promise<CollectionDetails> {
    const client = this.requireClient();
    const summary = await client.getCollectionSummary(name);
    const count = await client.countRecords(name);
    const dimensions = await this.resolveDimensions(name);

    return {
      name,
      dimensions,
      count,
      metric: summary.metric,
      provider: this.provider,
      status: "ready",
      config: {
        id: summary.id,
        configuration: summary.configuration,
        metadata: summary.metadata,
      },
    };
  }

  async listRecords(name: string, opts: ListOptions): Promise<VectorPage> {
    const plan = opts.filter ? toChromaFilter(opts.filter) : {};
    const offset = opts.cursor === undefined ? 0 : Number(opts.cursor);
    const records = await this.requireClient().getRecords(name, {
      ...(plan.ids ? { ids: plan.ids } : {}),
      ...(plan.where ? { where: plan.where } : {}),
      limit: opts.limit,
      offset: plan.ids ? 0 : Number.isFinite(offset) ? offset : 0,
      includeEmbeddings: opts.includeVectors ?? false,
    });

    this.cacheDimensionsFromRecords(name, records);

    const nextCursor = plan.ids
      ? undefined
      : records.length === opts.limit
        ? String((Number.isFinite(offset) ? offset : 0) + records.length)
        : undefined;

    return {
      records: records.map(toVectorRecord),
      ...(nextCursor ? { nextCursor } : {}),
    };
  }

  async getRecord(name: string, id: string): Promise<VectorRecord> {
    const records = await this.requireClient().getRecords(name, {
      ids: [id],
      includeEmbeddings: true,
    });
    const record = records[0];
    if (!record) {
      throw new Error(`Record "${id}" was not found in collection "${name}"`);
    }
    this.cacheDimensionsFromRecords(name, records);
    return toVectorRecord(record);
  }

  async searchByVector(name: string, opts: SearchOptions): Promise<SearchResult[]> {
    const matches = await this.requireClient().queryRecords(name, {
      embedding: opts.vector,
      nResults: opts.limit,
    });
    return matches.map((match) => ({
      record: toVectorRecord(match.record),
      score: match.distance,
    }));
  }

  async deleteRecords(name: string, ids: string[]): Promise<{ deleted: number }> {
    if (ids.length === 0) return { deleted: 0 };
    await this.requireClient().deleteRecords(name, ids);
    return { deleted: ids.length };
  }

  async getCollectionStats(name: string): Promise<CollectionStats> {
    const client = this.requireClient();
    const summary = await client.getCollectionSummary(name);
    const count = await client.countRecords(name);
    const dimensions = await this.resolveDimensions(name);

    return {
      status: "ready",
      counts: { points: count },
      vectorConfig: { dimensions, metric: summary.metric },
    };
  }

  private async resolveDimensions(name: string): Promise<number> {
    const cached = this.dimensionsCache.get(name);
    if (cached !== undefined) return cached;

    const sample = await this.requireClient().getRecords(name, {
      limit: 1,
      includeEmbeddings: true,
    });
    const dimensions = sample[0]?.embedding?.length ?? 0;
    if (dimensions > 0) {
      this.dimensionsCache.set(name, dimensions);
    }
    return dimensions;
  }

  private cacheDimensionsFromRecords(name: string, records: ChromaRecord[]): void {
    for (const record of records) {
      if (record.embedding && record.embedding.length > 0) {
        this.dimensionsCache.set(name, record.embedding.length);
        return;
      }
    }
  }

  private requireClient(): ChromaClientLike {
    if (this.client === null) {
      throw new Error("ChromaAdapter must be connected before use");
    }
    return this.client;
  }
}

function toVectorRecord(record: ChromaRecord): VectorRecord {
  const metadata = { ...record.metadata };
  if (record.document !== null && metadata["document"] === undefined) {
    metadata["document"] = record.document;
  }
  return {
    id: record.id,
    metadata,
    vector: record.embedding,
  };
}

// re-export for tests
export type { ChromaCollectionSummary };
