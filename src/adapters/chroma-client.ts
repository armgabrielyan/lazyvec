import { ChromaClient, CloudClient } from "chromadb";
import type { ConnectionProfile } from "../types";
import type { VectorMetric } from "./types";

export type ChromaWhere = Record<string, unknown>;

export interface ChromaCollectionSummary {
  id: string;
  name: string;
  metric: VectorMetric;
  configuration: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface ChromaRecord {
  id: string;
  metadata: Record<string, unknown>;
  embedding: number[] | null;
  document: string | null;
}

export interface ChromaGetOptions {
  ids?: string[];
  where?: ChromaWhere;
  limit?: number;
  offset?: number;
  includeEmbeddings?: boolean;
}

export interface ChromaQueryOptions {
  embedding: number[];
  nResults: number;
  where?: ChromaWhere;
}

export interface ChromaMatch {
  record: ChromaRecord;
  distance: number;
}

export interface ChromaClientLike {
  heartbeat(): Promise<void>;
  listCollections(): Promise<ChromaCollectionSummary[]>;
  getCollectionSummary(name: string): Promise<ChromaCollectionSummary>;
  countRecords(name: string): Promise<number>;
  getRecords(name: string, opts: ChromaGetOptions): Promise<ChromaRecord[]>;
  queryRecords(name: string, opts: ChromaQueryOptions): Promise<ChromaMatch[]>;
  deleteRecords(name: string, ids: string[]): Promise<void>;
}

export type ChromaClientFactory = (config: ConnectionProfile) => ChromaClientLike;

export interface ChromaLocalOptions {
  mode: "local";
  host: string;
  port: number;
  ssl: boolean;
  headers: Record<string, string>;
  tenant?: string;
  database?: string;
}

export interface ChromaCloudOptions {
  mode: "cloud";
  apiKey: string;
  tenant?: string;
  database?: string;
}

export type ChromaConnectionOptions = ChromaLocalOptions | ChromaCloudOptions;

export function parseChromaConnection(config: ConnectionProfile): ChromaConnectionOptions {
  if (!config.url) {
    if (!config.apiKey) {
      throw new Error(`Chroma connection "${config.name}" requires a url or api_key`);
    }
    return {
      mode: "cloud",
      apiKey: config.apiKey,
      ...(config.tenant ? { tenant: config.tenant } : {}),
      ...(config.database ? { database: config.database } : {}),
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(config.url);
  } catch {
    throw new Error(`Chroma connection "${config.name}" has an invalid url: ${config.url}`);
  }

  const ssl = parsed.protocol === "https:";
  const port = parsed.port ? Number(parsed.port) : ssl ? 443 : 80;
  const headers: Record<string, string> = {};
  if (config.apiKey) {
    headers["x-chroma-token"] = config.apiKey;
  }

  return {
    mode: "local",
    host: parsed.hostname,
    port,
    ssl,
    headers,
    ...(config.tenant ? { tenant: config.tenant } : {}),
    ...(config.database ? { database: config.database } : {}),
  };
}

export function createChromaClient(config: ConnectionProfile): ChromaClientLike {
  const options = parseChromaConnection(config);
  const client = options.mode === "cloud"
    ? new CloudClient({
        apiKey: options.apiKey,
        ...(options.tenant ? { tenant: options.tenant } : {}),
        ...(options.database ? { database: options.database } : {}),
      })
    : new ChromaClient({
        host: options.host,
        port: options.port,
        ssl: options.ssl,
        headers: options.headers,
        ...(options.tenant ? { tenant: options.tenant } : {}),
        ...(options.database ? { database: options.database } : {}),
      });

  return {
    async heartbeat() {
      await client.heartbeat();
    },

    async listCollections() {
      const collections = await client.listCollections();
      return collections.map(toSummary);
    },

    async getCollectionSummary(name) {
      const collection = await client.getCollection({ name });
      return toSummary(collection);
    },

    async countRecords(name) {
      const collection = await client.getCollection({ name });
      return collection.count();
    },

    async getRecords(name, opts) {
      const collection = await client.getCollection({ name });
      const include = opts.includeEmbeddings
        ? (["metadatas", "documents", "embeddings"] as const)
        : (["metadatas", "documents"] as const);
      const result = await collection.get({
        ...(opts.ids ? { ids: opts.ids } : {}),
        ...(opts.where ? { where: opts.where as never } : {}),
        ...(opts.limit === undefined ? {} : { limit: opts.limit }),
        ...(opts.offset === undefined ? {} : { offset: opts.offset }),
        include: include as never,
      });
      return toRecords(result.ids, result.metadatas, result.documents, opts.includeEmbeddings ? result.embeddings : null);
    },

    async queryRecords(name, opts) {
      const collection = await client.getCollection({ name });
      const result = await collection.query({
        queryEmbeddings: [opts.embedding],
        nResults: opts.nResults,
        ...(opts.where ? { where: opts.where as never } : {}),
        include: ["metadatas", "documents", "distances"] as never,
      });
      const ids = result.ids[0] ?? [];
      const metadatas = result.metadatas[0] ?? [];
      const documents = result.documents[0] ?? [];
      const distances = result.distances[0] ?? [];
      const records = toRecords(ids, metadatas, documents, null);
      return records.map((record, index) => ({
        record,
        distance: distances[index] ?? 0,
      }));
    },

    async deleteRecords(name, ids) {
      if (ids.length === 0) return;
      const collection = await client.getCollection({ name });
      await collection.delete({ ids });
    },
  };
}

interface RawCollection {
  id: string;
  name: string;
  configuration?: unknown;
  metadata?: unknown;
}

function toSummary(collection: RawCollection): ChromaCollectionSummary {
  const configuration = toRecord(collection.configuration);
  const metadata = toRecord(collection.metadata);
  return {
    id: collection.id,
    name: collection.name,
    metric: extractMetric(configuration, metadata),
    configuration,
    metadata,
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function extractMetric(
  configuration: Record<string, unknown>,
  metadata: Record<string, unknown>,
): VectorMetric {
  const hnsw = toRecord(configuration.hnsw);
  const space = typeof hnsw.space === "string" ? hnsw.space : metadata["hnsw:space"];
  return normalizeMetric(space);
}

function normalizeMetric(value: unknown): VectorMetric {
  const metric = typeof value === "string" ? value.toLowerCase() : "";
  if (metric === "cosine") return "cosine";
  if (metric === "l2" || metric === "euclidean") return "euclidean";
  if (metric === "ip" || metric === "dotproduct") return "dotproduct";
  return "unknown";
}

function toRecords(
  ids: string[],
  metadatas: Array<Record<string, unknown> | null>,
  documents: Array<string | null>,
  embeddings: number[][] | null,
): ChromaRecord[] {
  return ids.map((id, index) => ({
    id,
    metadata: toRecord(metadatas[index]),
    document: documents[index] ?? null,
    embedding: embeddings ? embeddings[index] ?? null : null,
  }));
}
