export type Provider = "qdrant";

export type Screen = "connections" | "main";

export type Panel = "collections" | "records" | "inspector";

export type ConnectionSource = "config" | "cli";

export interface ConnectionProfile {
  id: string;
  name: string;
  provider: Provider;
  url: string;
  description: string;
  source: ConnectionSource;
}

export interface ConnectionOnboarding {
  configPath: string;
  missingConfig: boolean;
}

export interface ConnectionState {
  connections: ConnectionProfile[];
  defaultConnectionId?: string;
  onboarding: ConnectionOnboarding;
}

export interface CollectionSummary {
  name: string;
  dimensions: number;
  count: number;
  metric: "cosine" | "euclidean" | "dotproduct" | "unknown";
  status: "ready" | "initializing" | "error";
}

export interface VectorRecord {
  id: string;
  dimensions: number;
  metadata: Record<string, unknown>;
  vector: number[];
}

export interface CollectionDataset extends CollectionSummary {
  records: VectorRecord[];
}
