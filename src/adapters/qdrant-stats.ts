import type {
  CollectionIndexConfig,
  CollectionQuantization,
  CollectionSharding,
  CollectionStats,
  CollectionStatsCounts,
  CollectionStatsVectorConfig,
  CollectionStatus,
  OptimizerStatus,
  PayloadIndex,
  VectorMetric,
} from "./types";
import type { QdrantCollectionAliases, QdrantCollectionInfo } from "./qdrant-client";

export function buildCollectionStats(
  info: QdrantCollectionInfo,
  aliases: QdrantCollectionAliases | null,
): CollectionStats {
  const config = toRecord(info.config);
  const params = toRecord(config.params);
  const vectors = toRecord(params.vectors);

  const stats: CollectionStats = {
    status: normalizeStatus(info.status),
    counts: buildCounts(info),
    vectorConfig: buildVectorConfig(vectors),
  };

  const optimizerStatus = normalizeOptimizerStatus(info.optimizer_status);
  if (optimizerStatus !== undefined) {
    stats.optimizerStatus = optimizerStatus;
  }

  const indexConfig = buildIndexConfig(config);
  if (indexConfig !== undefined) {
    stats.indexConfig = indexConfig;
  }

  const quantization = buildQuantization(config);
  if (quantization !== undefined) {
    stats.quantization = quantization;
  }

  const sharding = buildSharding(params);
  if (sharding !== undefined) {
    stats.sharding = sharding;
  }

  const payloadIndexes = buildPayloadIndexes(info.payload_schema);
  if (payloadIndexes !== undefined) {
    stats.payloadIndexes = payloadIndexes;
  }

  if (aliases !== null) {
    stats.aliases = buildAliases(aliases);
  }

  return stats;
}

function buildCounts(info: QdrantCollectionInfo): CollectionStatsCounts {
  const points = numberOrZero(info.points_count, info.vectors_count);
  const counts: CollectionStatsCounts = { points };

  if (typeof info.indexed_vectors_count === "number") {
    counts.indexedVectors = info.indexed_vectors_count;
  }

  if (typeof info.segments_count === "number") {
    counts.segments = info.segments_count;
  }

  return counts;
}

function buildVectorConfig(vectors: Record<string, unknown>): CollectionStatsVectorConfig {
  if (typeof vectors.size === "number") {
    return namedVectorConfig(vectors);
  }

  const firstNamed = Object.values(vectors).find((candidate) => {
    const record = toRecord(candidate);
    return typeof record.size === "number";
  });

  return namedVectorConfig(toRecord(firstNamed));
}

function namedVectorConfig(vectors: Record<string, unknown>): CollectionStatsVectorConfig {
  const dimensions = typeof vectors.size === "number" ? vectors.size : 0;
  const config: CollectionStatsVectorConfig = {
    dimensions,
    metric: normalizeMetric(vectors.distance),
  };

  if (typeof vectors.on_disk === "boolean") {
    config.onDisk = vectors.on_disk;
  }

  return config;
}

function buildIndexConfig(config: Record<string, unknown>): CollectionIndexConfig | undefined {
  const hnsw = toRecord(config.hnsw_config);
  if (Object.keys(hnsw).length === 0) {
    return undefined;
  }

  const index: CollectionIndexConfig = { kind: "hnsw" };

  if (typeof hnsw.m === "number") {
    index.m = hnsw.m;
  }
  if (typeof hnsw.ef_construct === "number") {
    index.efConstruct = hnsw.ef_construct;
  }
  if (typeof hnsw.full_scan_threshold === "number") {
    index.fullScanThreshold = hnsw.full_scan_threshold;
  }
  if (typeof hnsw.on_disk === "boolean") {
    index.onDisk = hnsw.on_disk;
  }

  return index;
}

function buildQuantization(config: Record<string, unknown>): CollectionQuantization | undefined {
  const quantization = toRecord(config.quantization_config);
  const entries = Object.entries(quantization);
  if (entries.length === 0) {
    return undefined;
  }

  const [kind, rawDetails] = entries[0]!;
  return {
    kind,
    details: toRecord(rawDetails),
  };
}

function buildSharding(params: Record<string, unknown>): CollectionSharding | undefined {
  if (typeof params.shard_number !== "number" || typeof params.replication_factor !== "number") {
    return undefined;
  }

  const sharding: CollectionSharding = {
    shardNumber: params.shard_number,
    replicationFactor: params.replication_factor,
  };

  if (typeof params.write_consistency_factor === "number") {
    sharding.writeConsistencyFactor = params.write_consistency_factor;
  }

  return sharding;
}

function buildPayloadIndexes(schema: unknown): PayloadIndex[] | undefined {
  if (typeof schema !== "object" || schema === null) {
    return undefined;
  }

  const entries = Object.entries(schema as Record<string, unknown>);
  if (entries.length === 0) {
    return undefined;
  }

  return entries.map(([field, value]) => {
    const record = toRecord(value);
    const index: PayloadIndex = {
      field,
      dataType: typeof record.data_type === "string" ? record.data_type : "unknown",
    };
    if (typeof record.points === "number") {
      index.indexedPoints = record.points;
    }
    return index;
  });
}

function buildAliases(aliases: QdrantCollectionAliases): string[] {
  return aliases.aliases
    .map((entry) => (typeof entry.alias_name === "string" ? entry.alias_name : null))
    .filter((name): name is string => name !== null);
}

function normalizeStatus(value: unknown): CollectionStatus {
  if (value === "green") {
    return "ready";
  }
  if (value === "yellow") {
    return "initializing";
  }
  if (value === "red") {
    return "error";
  }
  return "ready";
}

function normalizeOptimizerStatus(value: unknown): OptimizerStatus | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (value === "ok") {
    return { ok: true };
  }

  if (typeof value === "object" && value !== null && "error" in value) {
    const message = (value as Record<string, unknown>).error;
    return { ok: false, message: typeof message === "string" ? message : undefined };
  }

  return { ok: false };
}

function normalizeMetric(value: unknown): VectorMetric {
  const metric = typeof value === "string" ? value.toLowerCase() : "";

  if (metric === "cosine") return "cosine";
  if (metric === "euclid" || metric === "euclidean") return "euclidean";
  if (metric === "dot") return "dotproduct";
  return "unknown";
}

function numberOrZero(primary: unknown, fallback: unknown): number {
  if (typeof primary === "number") return primary;
  if (typeof fallback === "number") return fallback;
  return 0;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}
