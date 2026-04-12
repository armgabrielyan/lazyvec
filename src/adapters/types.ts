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
}

export interface Collection {
  name: string;
  dimensions: number;
  count: number;
  metric: VectorMetric;
  provider: Provider;
}

export interface CollectionDetails extends Collection {
  status: "ready" | "initializing" | "error";
  config: Record<string, unknown>;
}

export interface VectorRecord {
  id: string;
  metadata: Record<string, unknown>;
  vector: number[] | null;
}

export interface ListOptions {
  limit: number;
  cursor?: string;
  includeVectors?: boolean;
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
}
