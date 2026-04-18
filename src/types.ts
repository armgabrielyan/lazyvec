export type Provider = "qdrant" | "pinecone" | "chroma";

export type Screen = "connections" | "main";

export type Panel = "collections" | "records" | "inspector" | "stats";

export type RightTab = "records" | "stats";

export type ConnectionSource = "config" | "cli";

export type ConnectionStatus = "unknown" | "checking" | "reachable" | "unreachable";

export interface ConnectionProfile {
  id: string;
  name: string;
  provider: Provider;
  url?: string;
  apiKey?: string;
  tenant?: string;
  database?: string;
  urlRaw?: string;
  apiKeyRaw?: string;
  tenantRaw?: string;
  databaseRaw?: string;
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

export type ConnectionFormMode = { kind: "add" } | { kind: "edit"; connectionId: string };
