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
      offset?: QdrantPointId;
      filter?: Record<string, unknown>;
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
      ids: QdrantPointId[];
      with_payload: true;
      with_vector: true;
    },
  ): Promise<QdrantPoint[]>;
  search(
    collectionName: string,
    request: {
      vector: number[];
      limit: number;
      with_payload: true;
      with_vector: boolean;
    },
  ): Promise<Array<QdrantPoint & { score: number }>>;
  delete(
    collectionName: string,
    request: {
      points: QdrantPointId[];
    },
  ): Promise<{ status: string }>;
}

export type QdrantClientFactory = (config: ConnectionProfile) => QdrantClientLike;

export function createQdrantClient(config: ConnectionProfile): QdrantClientLike {
  return new QdrantClient({
    checkCompatibility: false,
    url: config.url,
  }) as unknown as QdrantClientLike;
}
