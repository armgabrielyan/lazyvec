import type {
  CollectionIndexConfig,
  CollectionQuantization,
  CollectionSharding,
  CollectionStats,
  CollectionStatus,
  OptimizerStatus,
  PayloadIndex,
} from "../adapters/types";

export interface StatsRow {
  label: string;
  value: string;
}

export interface StatsSection {
  title: string;
  rows: StatsRow[];
}

const EM_DASH = "—";

export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

export function formatOptional(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return EM_DASH;
  }
  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }
  if (typeof value === "number") {
    return formatCount(value);
  }
  return String(value);
}

export function formatStatusLabel(status: CollectionStatus): string {
  return status;
}

export function buildStatsSections(stats: CollectionStats): StatsSection[] {
  const sections: StatsSection[] = [
    overviewSection(stats),
    vectorsSection(stats),
  ];

  if (stats.indexConfig !== undefined) {
    sections.push(indexSection(stats.indexConfig));
  }

  if (stats.quantization !== undefined) {
    sections.push(quantizationSection(stats.quantization));
  }

  if (stats.sharding !== undefined) {
    sections.push(shardingSection(stats.sharding));
  }

  if (stats.payloadIndexes !== undefined && stats.payloadIndexes.length > 0) {
    sections.push(payloadIndexesSection(stats.payloadIndexes));
  }

  if (stats.aliases !== undefined && stats.aliases.length > 0) {
    sections.push(aliasesSection(stats.aliases));
  }

  if (stats.namespaces !== undefined && stats.namespaces.length > 0) {
    sections.push(namespacesSection(stats.namespaces));
  }

  return sections;
}

function overviewSection(stats: CollectionStats): StatsSection {
  const rows: StatsRow[] = [
    { label: "Status", value: formatStatusLabel(stats.status) },
  ];

  if (stats.optimizerStatus !== undefined) {
    rows.push({ label: "Optimizer", value: formatOptimizerStatus(stats.optimizerStatus) });
  }

  rows.push({ label: "Points", value: formatCount(stats.counts.points) });

  if (stats.counts.indexedVectors !== undefined) {
    rows.push({ label: "Indexed vectors", value: formatCount(stats.counts.indexedVectors) });
  }
  if (stats.counts.segments !== undefined) {
    rows.push({ label: "Segments", value: formatCount(stats.counts.segments) });
  }

  return { title: "Overview", rows };
}

function formatOptimizerStatus(status: OptimizerStatus): string {
  if (status.ok) {
    return "ok";
  }
  return status.message !== undefined ? `error: ${status.message}` : "error";
}

function vectorsSection(stats: CollectionStats): StatsSection {
  const rows: StatsRow[] = [
    { label: "Dimensions", value: formatCount(stats.vectorConfig.dimensions) },
    { label: "Metric", value: stats.vectorConfig.metric },
  ];
  if (stats.vectorConfig.onDisk !== undefined) {
    rows.push({ label: "On disk", value: formatOptional(stats.vectorConfig.onDisk) });
  }
  return { title: "Vectors", rows };
}

function indexSection(index: CollectionIndexConfig): StatsSection {
  if (index.kind === "hnsw") {
    const rows: StatsRow[] = [];
    if (index.m !== undefined) rows.push({ label: "m", value: formatCount(index.m) });
    if (index.efConstruct !== undefined) rows.push({ label: "ef_construct", value: formatCount(index.efConstruct) });
    if (index.fullScanThreshold !== undefined) {
      rows.push({ label: "Full scan threshold", value: formatCount(index.fullScanThreshold) });
    }
    if (index.onDisk !== undefined) rows.push({ label: "On disk", value: formatOptional(index.onDisk) });
    return { title: "Index (HNSW)", rows };
  }

  return {
    title: "Index",
    rows: Object.entries(index.details).map(([label, value]) => ({ label, value: formatOptional(value) })),
  };
}

function quantizationSection(quantization: CollectionQuantization): StatsSection {
  const rows: StatsRow[] = [{ label: "Kind", value: quantization.kind }];
  for (const [label, value] of Object.entries(quantization.details)) {
    rows.push({ label, value: formatOptional(value) });
  }
  return { title: "Quantization", rows };
}

function shardingSection(sharding: CollectionSharding): StatsSection {
  const rows: StatsRow[] = [
    { label: "Shards", value: formatCount(sharding.shardNumber) },
    { label: "Replication factor", value: formatCount(sharding.replicationFactor) },
  ];
  if (sharding.writeConsistencyFactor !== undefined) {
    rows.push({ label: "Write consistency", value: formatCount(sharding.writeConsistencyFactor) });
  }
  return { title: "Sharding", rows };
}

function payloadIndexesSection(indexes: PayloadIndex[]): StatsSection {
  return {
    title: "Payload indexes",
    rows: indexes.map((index) => ({
      label: index.field,
      value: index.indexedPoints === undefined
        ? index.dataType
        : `${index.dataType} · ${formatCount(index.indexedPoints)}`,
    })),
  };
}

function aliasesSection(aliases: string[]): StatsSection {
  return {
    title: "Aliases",
    rows: aliases.map((alias) => ({ label: alias, value: "" })),
  };
}

function namespacesSection(namespaces: CollectionStats["namespaces"]): StatsSection {
  return {
    title: "Namespaces",
    rows: (namespaces ?? []).map((ns) => ({ label: ns.name, value: formatCount(ns.count) })),
  };
}
