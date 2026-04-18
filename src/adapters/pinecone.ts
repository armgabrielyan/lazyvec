import type {
  AdapterCapabilities,
  Collection,
  CollectionDetails,
  CollectionStats,
  HealthStatus,
  ListOptions,
  NamespaceStats,
  SearchOptions,
  SearchResult,
  VectorDBAdapter,
  VectorPage,
  VectorRecord,
} from "./types";
import {
  createPineconeClient,
  type PineconeClientFactory,
  type PineconeClientLike,
  type PineconeIndexStats,
  type PineconeIndexSummary,
  type PineconeRecordShape,
} from "./pinecone-client";
import { toPineconeFilter } from "./pinecone-filter";
import type { ConnectionProfile } from "../types";

export const pineconeCapabilities: AdapterCapabilities = {
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
};

interface PineconeAdapterOptions {
  client?: PineconeClientLike;
  clientFactory?: PineconeClientFactory;
  now?: () => number;
}

export class PineconeAdapter implements VectorDBAdapter {
  readonly provider = "pinecone" as const;
  readonly capabilities = pineconeCapabilities;

  private client: PineconeClientLike | null = null;
  private readonly clientFactory: PineconeClientFactory;
  private readonly now: () => number;
  private readonly indexCache = new Map<string, PineconeIndexSummary>();

  constructor(options: PineconeAdapterOptions = {}) {
    this.client = options.client ?? null;
    this.clientFactory = options.clientFactory ?? createPineconeClient;
    this.now = options.now ?? Date.now;
  }

  async connect(config: ConnectionProfile): Promise<void> {
    if (config.provider !== "pinecone") {
      throw new Error(`PineconeAdapter cannot connect to provider "${config.provider}"`);
    }

    this.client ??= this.clientFactory(config);
    this.indexCache.clear();
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this.indexCache.clear();
  }

  async healthCheck(): Promise<HealthStatus> {
    const start = this.now();
    await this.requireClient().listIndexes();
    return {
      connected: true,
      latencyMs: this.now() - start,
      provider: this.provider,
    };
  }

  async listCollections(): Promise<Collection[]> {
    const client = this.requireClient();
    const summaries = await client.listIndexes();
    this.primeCache(summaries);

    const rows: Collection[] = [];
    for (const summary of summaries) {
      const stats = await client.describeIndexStats(summary.host);
      const namespaces = stats.namespaces.length > 0 ? stats.namespaces : [{ name: "", count: stats.totalRecordCount ?? 0 }];
      for (const ns of namespaces) {
        rows.push({
          name: encodeCollection(summary.name, ns.name),
          dimensions: summary.dimension,
          count: ns.count,
          metric: summary.metric,
          provider: this.provider,
        });
      }
    }
    return rows;
  }

  async describeCollection(name: string): Promise<CollectionDetails> {
    const { indexName, namespace } = decodeCollection(name);
    const summary = await this.resolveIndex(indexName);
    const stats = await this.requireClient().describeIndexStats(summary.host);
    const count = findNamespaceCount(stats, namespace) ?? stats.totalRecordCount ?? 0;

    return {
      name,
      dimensions: summary.dimension,
      count,
      metric: summary.metric,
      provider: this.provider,
      status: summary.status,
      config: {
        host: summary.host,
        namespace,
        serverless: summary.isServerless,
      },
    };
  }

  async listRecords(name: string, opts: ListOptions): Promise<VectorPage> {
    const { indexName, namespace } = decodeCollection(name);
    const summary = await this.resolveIndex(indexName);
    this.ensureServerless(summary);
    const client = this.requireClient();

    const plan = opts.filter ? toPineconeFilter(opts.filter) : { idFilter: [] as string[] };
    if (plan.metadataFilter) {
      throw new Error("Pinecone adapter does not support metadata filters in record listing. Use id:<value> to look up by ID.");
    }

    if (plan.idFilter.length > 0) {
      const records = await client.fetch(summary.host, namespace, plan.idFilter);
      return { records: records.map(toVectorRecord) };
    }

    const page = await client.listPaginatedIds(summary.host, namespace, {
      limit: opts.limit,
      ...(opts.cursor === undefined ? {} : { paginationToken: opts.cursor }),
    });
    if (page.ids.length === 0) {
      return { records: [], ...(page.nextToken ? { nextCursor: page.nextToken } : {}) };
    }
    const records = await client.fetch(summary.host, namespace, page.ids);
    return {
      records: records.map(toVectorRecord),
      ...(page.nextToken ? { nextCursor: page.nextToken } : {}),
    };
  }

  async getRecord(name: string, id: string): Promise<VectorRecord> {
    const { indexName, namespace } = decodeCollection(name);
    const summary = await this.resolveIndex(indexName);
    const records = await this.requireClient().fetch(summary.host, namespace, [id]);
    const record = records[0];
    if (!record) {
      throw new Error(`Record "${id}" was not found in "${name}"`);
    }
    return toVectorRecord(record);
  }

  async searchByVector(name: string, opts: SearchOptions): Promise<SearchResult[]> {
    const { indexName, namespace } = decodeCollection(name);
    const summary = await this.resolveIndex(indexName);
    const matches = await this.requireClient().query(summary.host, namespace, {
      vector: opts.vector,
      topK: opts.limit,
    });
    return matches.map((match) => ({
      record: toVectorRecord(match.record),
      score: match.score,
    }));
  }

  async deleteRecords(name: string, ids: string[]): Promise<{ deleted: number }> {
    if (ids.length === 0) return { deleted: 0 };
    const { indexName, namespace } = decodeCollection(name);
    const summary = await this.resolveIndex(indexName);
    await this.requireClient().deleteMany(summary.host, namespace, ids);
    return { deleted: ids.length };
  }

  async getCollectionStats(name: string): Promise<CollectionStats> {
    const { indexName, namespace } = decodeCollection(name);
    const summary = await this.resolveIndex(indexName);
    const stats = await this.requireClient().describeIndexStats(summary.host);
    const namespaceCount = findNamespaceCount(stats, namespace);
    const points = namespaceCount ?? stats.totalRecordCount ?? 0;

    const namespaces: NamespaceStats[] = stats.namespaces.map((ns) => ({
      name: ns.name === "" ? "(default)" : ns.name,
      count: ns.count,
    }));

    return {
      status: summary.status,
      counts: { points },
      vectorConfig: {
        dimensions: stats.dimension ?? summary.dimension,
        metric: summary.metric,
      },
      ...(namespaces.length > 0 ? { namespaces } : {}),
    };
  }

  private async resolveIndex(indexName: string): Promise<PineconeIndexSummary> {
    const cached = this.indexCache.get(indexName);
    if (cached) return cached;
    const summary = await this.requireClient().describeIndex(indexName);
    this.indexCache.set(indexName, summary);
    return summary;
  }

  private primeCache(summaries: PineconeIndexSummary[]): void {
    for (const summary of summaries) {
      this.indexCache.set(summary.name, summary);
    }
  }

  private ensureServerless(summary: PineconeIndexSummary): void {
    if (!summary.isServerless) {
      throw new Error(
        `Index "${summary.name}" is pod-based. lazyvec only supports browsing serverless Pinecone indexes.`,
      );
    }
  }

  private requireClient(): PineconeClientLike {
    if (this.client === null) {
      throw new Error("PineconeAdapter must be connected before use");
    }
    return this.client;
  }
}

function encodeCollection(indexName: string, namespace: string): string {
  return namespace === "" ? indexName : `${indexName}/${namespace}`;
}

function decodeCollection(encoded: string): { indexName: string; namespace: string } {
  const slash = encoded.indexOf("/");
  if (slash === -1) return { indexName: encoded, namespace: "" };
  return { indexName: encoded.slice(0, slash), namespace: encoded.slice(slash + 1) };
}

function findNamespaceCount(stats: PineconeIndexStats, namespace: string): number | undefined {
  const match = stats.namespaces.find((ns) => ns.name === namespace);
  return match?.count;
}

function toVectorRecord(record: PineconeRecordShape): VectorRecord {
  return {
    id: record.id,
    metadata: record.metadata ?? {},
    vector: record.values ?? null,
  };
}
