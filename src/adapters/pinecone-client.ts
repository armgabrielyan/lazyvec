import type { ConnectionProfile } from "../types";
import { Pinecone } from "@pinecone-database/pinecone";
import type { VectorMetric } from "./types";

export interface PineconeIndexSummary {
  name: string;
  host: string;
  dimension: number;
  metric: VectorMetric;
  isServerless: boolean;
  status: "ready" | "initializing" | "error" | "degraded";
}

export interface PineconeNamespaceStats {
  name: string;
  count: number;
}

export interface PineconeIndexStats {
  dimension?: number;
  indexFullness?: number;
  totalRecordCount?: number;
  namespaces: PineconeNamespaceStats[];
}

export interface PineconeRecordShape {
  id: string;
  values?: number[];
  metadata?: Record<string, unknown>;
}

export interface PineconeQueryMatch {
  record: PineconeRecordShape;
  score: number;
}

export interface PineconeListPage {
  ids: string[];
  nextToken?: string;
}

export interface PineconeClientLike {
  listIndexes(): Promise<PineconeIndexSummary[]>;
  describeIndex(name: string): Promise<PineconeIndexSummary>;
  describeIndexStats(host: string): Promise<PineconeIndexStats>;
  listPaginatedIds(
    host: string,
    namespace: string,
    opts: { prefix?: string; paginationToken?: string; limit?: number },
  ): Promise<PineconeListPage>;
  fetch(host: string, namespace: string, ids: string[]): Promise<PineconeRecordShape[]>;
  query(
    host: string,
    namespace: string,
    opts: { vector: number[]; topK: number; filter?: object },
  ): Promise<PineconeQueryMatch[]>;
  deleteMany(host: string, namespace: string, ids: string[]): Promise<void>;
}

export type PineconeClientFactory = (config: ConnectionProfile) => PineconeClientLike;

export function createPineconeClient(config: ConnectionProfile): PineconeClientLike {
  if (!config.apiKey) {
    throw new Error(`Pinecone connection "${config.name}" requires an api_key`);
  }

  const pc = new Pinecone({ apiKey: config.apiKey });

  return {
    async listIndexes() {
      const response = await pc.listIndexes();
      const indexes = response.indexes ?? [];
      return indexes.map(toIndexSummary);
    },

    async describeIndex(name: string) {
      const model = await pc.describeIndex(name);
      return toIndexSummary(model);
    },

    async describeIndexStats(host: string) {
      const stats = await pc.index({ host }).describeIndexStats();
      const namespaces: PineconeNamespaceStats[] = Object.entries(stats.namespaces ?? {}).map(
        ([name, summary]) => ({ name, count: summary.recordCount }),
      );
      return {
        dimension: stats.dimension,
        indexFullness: stats.indexFullness,
        totalRecordCount: stats.totalRecordCount,
        namespaces,
      };
    },

    async listPaginatedIds(host, namespace, opts) {
      const response = await pc.index({ host }).listPaginated({
        ...(opts.prefix === undefined ? {} : { prefix: opts.prefix }),
        ...(opts.paginationToken === undefined ? {} : { paginationToken: opts.paginationToken }),
        ...(opts.limit === undefined ? {} : { limit: opts.limit }),
        namespace,
      });
      const ids = (response.vectors ?? [])
        .map((v) => v.id)
        .filter((id): id is string => typeof id === "string");
      const nextToken = response.pagination?.next;
      return {
        ids,
        ...(nextToken ? { nextToken } : {}),
      };
    },

    async fetch(host, namespace, ids) {
      if (ids.length === 0) return [];
      const response = await pc.index({ host }).fetch({ ids, namespace });
      return Object.values(response.records ?? {}).map(toRecordShape);
    },

    async query(host, namespace, opts) {
      const response = await pc.index({ host }).query({
        vector: opts.vector,
        topK: opts.topK,
        namespace,
        includeMetadata: true,
        includeValues: false,
        ...(opts.filter ? { filter: opts.filter } : {}),
      });
      return (response.matches ?? []).map((match) => ({
        record: toRecordShape(match),
        score: match.score ?? 0,
      }));
    },

    async deleteMany(host, namespace, ids) {
      if (ids.length === 0) return;
      await pc.index({ host }).deleteMany({ ids, namespace });
    },
  };
}

interface PineconeRawSpec {
  serverless?: unknown;
  pod?: unknown;
  byoc?: unknown;
}

interface PineconeRawIndex {
  name: string;
  host: string;
  dimension?: number;
  metric: string;
  spec: PineconeRawSpec;
  status: { ready?: boolean; state?: string };
}

function toIndexSummary(model: PineconeRawIndex): PineconeIndexSummary {
  return {
    name: model.name,
    host: model.host,
    dimension: model.dimension ?? 0,
    metric: normalizeMetric(model.metric),
    isServerless: Boolean(model.spec.serverless),
    status: normalizeStatus(model.status),
  };
}

function normalizeMetric(raw: string): VectorMetric {
  const value = raw.toLowerCase();
  if (value === "cosine") return "cosine";
  if (value === "euclidean" || value === "euclid") return "euclidean";
  if (value === "dotproduct") return "dotproduct";
  return "unknown";
}

function normalizeStatus(status: { ready?: boolean; state?: string }): PineconeIndexSummary["status"] {
  const state = (status.state ?? "").toLowerCase();
  if (state === "ready" || status.ready === true) return "ready";
  if (state === "initializing" || state === "scalingup" || state === "scalingdown") return "initializing";
  if (state === "terminating" || state === "initializationfailed") return "error";
  return "initializing";
}

function toRecordShape(record: {
  id?: string;
  values?: number[];
  metadata?: Record<string, unknown>;
}): PineconeRecordShape {
  return {
    id: record.id ?? "",
    ...(record.values ? { values: record.values } : {}),
    ...(record.metadata ? { metadata: record.metadata } : {}),
  };
}
