import type { Collection, HealthStatus, VectorDBAdapter, VectorPage, VectorRecord } from "../adapters/types";

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
): Promise<VectorPage> {
  return adapter.listRecords(collectionName, {
    limit: options.pageSize,
    includeVectors: false,
  });
}

export function loadRecordDetails(
  adapter: VectorDBAdapter,
  collectionName: string,
  recordId: string,
): Promise<VectorRecord> {
  return adapter.getRecord(collectionName, recordId);
}
