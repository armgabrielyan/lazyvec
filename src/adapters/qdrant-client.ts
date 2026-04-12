import type { ConnectionProfile } from "../types";
import { QdrantClient } from "@qdrant/js-client-rest";

export type QdrantPointId = string | number;

export interface QdrantPoint {
  id: QdrantPointId;
  payload?: Record<string, unknown> | null;
  vector?: unknown;
}

export interface QdrantCollectionInfo {
  status?: unknown;
  points_count?: unknown;
  vectors_count?: unknown;
  config?: unknown;
}

export interface QdrantClientLike {
  getCollections(): Promise<{
    collections: Array<{ name: string }>;
  }>;
  getCollection(collectionName: string): Promise<QdrantCollectionInfo>;
  scroll(
    collectionName: string,
    request: {
      limit: number;
      offset?: string;
      with_payload: true;
      with_vector: boolean;
    },
  ): Promise<{
    points: QdrantPoint[];
    next_page_offset?: QdrantPointId | null;
  }>;
  retrieve(
    collectionName: string,
    request: {
      ids: string[];
      with_payload: true;
      with_vector: true;
    },
  ): Promise<QdrantPoint[]>;
}

export type QdrantClientFactory = (config: ConnectionProfile) => QdrantClientLike;

export function createQdrantClient(config: ConnectionProfile): QdrantClientLike {
  return new QdrantClient({
    checkCompatibility: false,
    url: config.url,
  }) as unknown as QdrantClientLike;
}
