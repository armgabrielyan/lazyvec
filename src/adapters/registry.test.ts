import { describe, expect, test } from "bun:test";
import { createAdapter } from "./registry";
import type { AdapterCapabilities, HealthStatus, ListOptions, VectorDBAdapter } from "./types";
import type { ConnectionProfile } from "../types";

const capabilities: AdapterCapabilities = {
  listCollections: true,
  describeCollection: true,
  listRecords: true,
  getRecord: true,
  includeVectorsInList: false,
  metadataFilter: false,
  namespaces: false,
  searchByVector: false,
  searchByText: false,
  deleteRecords: false,
  getCollectionStats: true,
};

class FakeAdapter implements VectorDBAdapter {
  readonly provider = "qdrant" as const;
  readonly capabilities = capabilities;
  connectedTo: ConnectionProfile | null = null;

  async connect(config: ConnectionProfile): Promise<void> {
    this.connectedTo = config;
  }

  async disconnect(): Promise<void> {}

  async healthCheck(): Promise<HealthStatus> {
    return { connected: true, latencyMs: 0, provider: "qdrant" };
  }

  async listCollections() {
    return [];
  }

  async describeCollection(name: string) {
    return {
      name,
      dimensions: 0,
      count: 0,
      metric: "unknown" as const,
      provider: "qdrant" as const,
      status: "ready" as const,
      config: {},
    };
  }

  async listRecords(_collection: string, _opts: ListOptions) {
    return { records: [] };
  }

  async getRecord(_collection: string, id: string) {
    return { id, metadata: {}, vector: null };
  }

  async searchByVector() {
    return [];
  }

  async deleteRecords(_collection: string, ids: string[]) {
    return { deleted: ids.length };
  }

  async getCollectionStats() {
    return {
      status: "ready" as const,
      counts: { points: 0 },
      vectorConfig: { dimensions: 0, metric: "unknown" as const },
    };
  }
}

const qdrantConnection: ConnectionProfile = {
  id: "local-qdrant",
  name: "local-qdrant",
  provider: "qdrant",
  url: "http://localhost:6333",
  description: "test connection",
  source: "cli",
};

describe("createAdapter", () => {
  test("creates and connects a Qdrant adapter", async () => {
    const fakeAdapter = new FakeAdapter();
    const adapter = await createAdapter(qdrantConnection, {
      qdrant: () => fakeAdapter,
    });

    expect(adapter).toBe(fakeAdapter);
    expect(fakeAdapter.connectedTo).toBe(qdrantConnection);
  });

  test("fails clearly for unsupported providers", async () => {
    await expect(
      createAdapter({ ...qdrantConnection, provider: "weaviate" as "qdrant" }),
    ).rejects.toThrow("Unknown provider: weaviate");
  });
});
