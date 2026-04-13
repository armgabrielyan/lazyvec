import type { Collection, HealthStatus, SearchResult, VectorDBAdapter, VectorPage, VectorRecord } from "../adapters/types";
import type { FilterCondition } from "../filter/parse";

export interface BrowserDataOptions {
  pageSize: number;
}

export interface BrowserData {
  health: HealthStatus;
  collections: Collection[];
  records: VectorRecord[];
  recordCursor?: string;
}

export async function loadInitialBrowserData(
  adapter: VectorDBAdapter,
  options: BrowserDataOptions,
): Promise<BrowserData> {
  const health = await adapter.healthCheck();
  const collections = await adapter.listCollections();
  const selectedCollection = collections[0];

  if (!selectedCollection) {
    return {
      health,
      collections,
      records: [],
    };
  }

  const page = await loadCollectionRecords(adapter, selectedCollection.name, options);

  return {
    health,
    collections,
    records: page.records,
    recordCursor: page.nextCursor,
  };
}

export async function loadCollectionRecords(
  adapter: VectorDBAdapter,
  collectionName: string,
  options: BrowserDataOptions,
  filter?: FilterCondition[],
): Promise<VectorPage> {
  return adapter.listRecords(collectionName, {
    limit: options.pageSize,
    filter: filter && filter.length > 0 ? filter : undefined,
    includeVectors: false,
  });
}

export async function loadNextCollectionRecords(
  adapter: VectorDBAdapter,
  collectionName: string,
  cursor: string,
  options: BrowserDataOptions,
  filter?: FilterCondition[],
): Promise<VectorPage> {
  return adapter.listRecords(collectionName, {
    limit: options.pageSize,
    cursor,
    filter: filter && filter.length > 0 ? filter : undefined,
    includeVectors: false,
  });
}

export function searchSimilarRecords(
  adapter: VectorDBAdapter,
  collectionName: string,
  vector: number[],
  limit: number,
): Promise<SearchResult[]> {
  return adapter.searchByVector(collectionName, { vector, limit });
}

export function loadRecordDetails(
  adapter: VectorDBAdapter,
  collectionName: string,
  recordId: string,
): Promise<VectorRecord> {
  return adapter.getRecord(collectionName, recordId);
}
