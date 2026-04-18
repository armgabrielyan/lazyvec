import type { FilterCondition } from "../filter/parse";
import type { ConnectionProfile, Provider } from "../types";

export type VectorMetric = "cosine" | "euclidean" | "dotproduct" | "unknown";

export interface AdapterCapabilities {
  listCollections: boolean;
  describeCollection: boolean;
  listRecords: boolean;
  getRecord: boolean;
  includeVectorsInList: boolean;
  metadataFilter: boolean;
  namespaces: boolean;
  searchByVector: boolean;
  searchByText: boolean;
  deleteRecords: boolean;
  getCollectionStats: boolean;
}

export type CollectionStatus = "ready" | "initializing" | "error" | "degraded";

export interface Collection {
  name: string;
  dimensions: number;
  count: number;
  metric: VectorMetric;
  provider: Provider;
}

export interface CollectionDetails extends Collection {
  status: CollectionStatus;
  config: Record<string, unknown>;
}

export interface VectorRecord {
  id: string;
  metadata: Record<string, unknown>;
  vector: number[] | null;
}

export interface SearchResult {
  record: VectorRecord;
  score: number;
}

export interface ListOptions {
  limit: number;
  cursor?: string;
  filter?: FilterCondition[];
  includeVectors?: boolean;
}

export interface SearchOptions {
  vector: number[];
  limit: number;
}

export interface VectorPage {
  records: VectorRecord[];
  nextCursor?: string;
}

export interface HealthStatus {
  connected: boolean;
  latencyMs: number;
  provider: Provider;
}

export interface CollectionStatsCounts {
  points: number;
  indexedVectors?: number;
  segments?: number;
}

export interface CollectionStatsVectorConfig {
  dimensions: number;
  metric: VectorMetric;
  onDisk?: boolean;
}

export interface HnswIndexConfig {
  kind: "hnsw";
  m?: number;
  efConstruct?: number;
  fullScanThreshold?: number;
  onDisk?: boolean;
}

export interface OtherIndexConfig {
  kind: "other";
  details: Record<string, unknown>;
}

export type CollectionIndexConfig = HnswIndexConfig | OtherIndexConfig;

export interface CollectionQuantization {
  kind: string;
  details: Record<string, unknown>;
}

export interface CollectionSharding {
  shardNumber: number;
  replicationFactor: number;
  writeConsistencyFactor?: number;
}

export interface PayloadIndex {
  field: string;
  dataType: string;
  indexedPoints?: number;
}

export interface NamespaceStats {
  name: string;
  count: number;
}

export interface OptimizerStatus {
  ok: boolean;
  message?: string;
}

export interface CollectionStats {
  status: CollectionStatus;
  optimizerStatus?: OptimizerStatus;
  counts: CollectionStatsCounts;
  vectorConfig: CollectionStatsVectorConfig;
  indexConfig?: CollectionIndexConfig;
  quantization?: CollectionQuantization;
  sharding?: CollectionSharding;
  payloadIndexes?: PayloadIndex[];
  aliases?: string[];
  namespaces?: NamespaceStats[];
}

export interface VectorDBAdapter {
  readonly provider: Provider;
  readonly capabilities: AdapterCapabilities;

  connect(config: ConnectionProfile): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<HealthStatus>;
  listCollections(): Promise<Collection[]>;
  describeCollection(name: string): Promise<CollectionDetails>;
  listRecords(collection: string, opts: ListOptions): Promise<VectorPage>;
  getRecord(collection: string, id: string): Promise<VectorRecord>;
  searchByVector(collection: string, opts: SearchOptions): Promise<SearchResult[]>;
  deleteRecords(collection: string, ids: string[]): Promise<{ deleted: number }>;
  getCollectionStats(collection: string): Promise<CollectionStats>;
}
