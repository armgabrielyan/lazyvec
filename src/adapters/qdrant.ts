import type {
  AdapterCapabilities,
  Collection,
  CollectionDetails,
  HealthStatus,
  ListOptions,
  SearchOptions,
  SearchResult,
  VectorDBAdapter,
  VectorMetric,
  VectorPage,
  VectorRecord,
} from "./types";
import { createQdrantClient, type QdrantClientFactory, type QdrantClientLike, type QdrantPoint, type QdrantPointId } from "./qdrant-client";
import type { ConnectionProfile } from "../types";
import { toQdrantFilter } from "./qdrant-filter";

export const qdrantCapabilities: AdapterCapabilities = {
  listCollections: true,
  describeCollection: true,
  listRecords: true,
  getRecord: true,
  includeVectorsInList: false,
  metadataFilter: true,
  namespaces: false,
  searchByVector: true,
  searchByText: false,
  deleteRecords: false,
};

interface QdrantAdapterOptions {
  client?: QdrantClientLike;
  clientFactory?: QdrantClientFactory;
  now?: () => number;
}

export class QdrantAdapter implements VectorDBAdapter {
  readonly provider = "qdrant" as const;
  readonly capabilities = qdrantCapabilities;

  private client: QdrantClientLike | null = null;
  private readonly clientFactory: QdrantClientFactory;
  private readonly now: () => number;

  constructor(options: QdrantAdapterOptions = {}) {
    this.client = options.client ?? null;
    this.clientFactory = options.clientFactory ?? createQdrantClient;
    this.now = options.now ?? Date.now;
  }

  async connect(config: ConnectionProfile): Promise<void> {
    if (config.provider !== "qdrant") {
      throw new Error(`QdrantAdapter cannot connect to provider "${config.provider}"`);
    }

    this.client ??= this.clientFactory(config);
  }

  async disconnect(): Promise<void> {
    this.client = null;
  }

  async healthCheck(): Promise<HealthStatus> {
    const start = this.now();
    await this.requireClient().getCollections();

    return {
      connected: true,
      latencyMs: this.now() - start,
      provider: this.provider,
    };
  }

  async listCollections(): Promise<Collection[]> {
    const response = await this.requireClient().getCollections();

    return Promise.all(
      response.collections.map(async (collection) => {
        const details = await this.describeCollection(collection.name);

        return {
          name: details.name,
          dimensions: details.dimensions,
          count: details.count,
          metric: details.metric,
          provider: details.provider,
        };
      }),
    );
  }

  async describeCollection(name: string): Promise<CollectionDetails> {
    const response = await this.requireClient().getCollection(name);
    const config = toRecord(response.config);
    const vectorConfig = extractVectorConfig(config);

    return {
      name,
      dimensions: vectorConfig.dimensions,
      count: extractCount(response),
      metric: vectorConfig.metric,
      provider: this.provider,
      status: normalizeStatus(response.status),
      config,
    };
  }

  async listRecords(collection: string, opts: ListOptions): Promise<VectorPage> {
    const filter = opts.filter ? toQdrantFilter(opts.filter) : undefined;
    const response = await this.requireClient().scroll(collection, {
      limit: opts.limit,
      offset: opts.cursor === undefined ? undefined : toQdrantPointId(opts.cursor),
      filter: filter as Record<string, unknown> | undefined,
      with_payload: true,
      with_vector: opts.includeVectors ?? false,
    });

    return {
      records: response.points.map(normalizePoint),
      nextCursor: response.next_page_offset === undefined || response.next_page_offset === null
        ? undefined
        : String(response.next_page_offset),
    };
  }

  async getRecord(collection: string, id: string): Promise<VectorRecord> {
    const records = await this.requireClient().retrieve(collection, {
      ids: [toQdrantPointId(id)],
      with_payload: true,
      with_vector: true,
    });
    const record = records[0];

    if (!record) {
      throw new Error(`Record "${id}" was not found in collection "${collection}"`);
    }

    return normalizePoint(record);
  }

  async searchByVector(collection: string, opts: SearchOptions): Promise<SearchResult[]> {
    const response = await this.requireClient().search(collection, {
      vector: opts.vector,
      limit: opts.limit,
      with_payload: true,
      with_vector: false,
    });

    return response.map((point) => ({
      record: normalizePoint(point),
      score: point.score,
    }));
  }

  private requireClient(): QdrantClientLike {
    if (this.client === null) {
      throw new Error("QdrantAdapter must be connected before use");
    }

    return this.client;
  }
}

function toQdrantPointId(id: string): QdrantPointId {
  return /^\d+$/.test(id) ? Number(id) : id;
}

function normalizePoint(point: QdrantPoint): VectorRecord {
  return {
    id: String(point.id),
    metadata: point.payload ?? {},
    vector: extractVector(point.vector),
  };
}

function extractVector(value: unknown): number[] | null {
  if (Array.isArray(value) && value.every((item) => typeof item === "number")) {
    return value;
  }

  if (typeof value === "object" && value !== null) {
    const firstVector = Object.values(value).find(
      (candidate) => Array.isArray(candidate) && candidate.every((item) => typeof item === "number"),
    );

    return firstVector === undefined ? null : firstVector as number[];
  }

  return null;
}

function extractCount(response: { points_count?: unknown; vectors_count?: unknown }): number {
  if (typeof response.points_count === "number") {
    return response.points_count;
  }

  if (typeof response.vectors_count === "number") {
    return response.vectors_count;
  }

  return 0;
}

function extractVectorConfig(config: Record<string, unknown>): {
  dimensions: number;
  metric: VectorMetric;
} {
  const params = toRecord(config.params);
  const vectors = toRecord(params.vectors);

  if (typeof vectors.size === "number") {
    return {
      dimensions: vectors.size,
      metric: normalizeMetric(vectors.distance),
    };
  }

  const firstNamedVector = Object.values(vectors).find((candidate) => {
    const candidateRecord = toRecord(candidate);
    return typeof candidateRecord.size === "number";
  });
  const namedVectorConfig = toRecord(firstNamedVector);

  return {
    dimensions: typeof namedVectorConfig.size === "number" ? namedVectorConfig.size : 0,
    metric: normalizeMetric(namedVectorConfig.distance),
  };
}

function normalizeMetric(value: unknown): VectorMetric {
  const metric = typeof value === "string" ? value.toLowerCase() : "";

  if (metric === "cosine") {
    return "cosine";
  }

  if (metric === "euclid" || metric === "euclidean") {
    return "euclidean";
  }

  if (metric === "dot") {
    return "dotproduct";
  }

  return "unknown";
}

function normalizeStatus(value: unknown): CollectionDetails["status"] {
  if (value === "green") {
    return "ready";
  }

  if (value === "yellow") {
    return "initializing";
  }

  if (value === "red") {
    return "error";
  }

  return "ready";
}

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}
