import { describe, expect, test } from "bun:test";
import type { CollectionStats } from "../adapters/types";
import {
  buildStatsSections,
  formatCount,
  formatOptional,
  formatStatusLabel,
} from "./collection-stats";

const richStats: CollectionStats = {
  status: "ready",
  optimizerStatus: { ok: true },
  counts: { points: 18820, indexedVectors: 18828, segments: 2 },
  vectorConfig: { dimensions: 384, metric: "cosine", onDisk: false },
  indexConfig: {
    kind: "hnsw",
    m: 16,
    efConstruct: 100,
    fullScanThreshold: 10000,
    onDisk: false,
  },
  quantization: {
    kind: "scalar",
    details: { type: "int8", quantile: 0.99, always_ram: true },
  },
  sharding: {
    shardNumber: 1,
    replicationFactor: 2,
    writeConsistencyFactor: 1,
  },
  payloadIndexes: [
    { field: "text", dataType: "text", indexedPoints: 18725 },
    { field: "sections", dataType: "keyword" },
  ],
  aliases: ["current", "live"],
};

const minimalStats: CollectionStats = {
  status: "ready",
  counts: { points: 0 },
  vectorConfig: { dimensions: 8, metric: "euclidean" },
};

describe("collection-stats formatting primitives", () => {
  test("formatCount groups thousands", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(18820)).toBe("18,820");
    expect(formatCount(1_000_000)).toBe("1,000,000");
  });

  test("formatOptional returns em-dash for null/undefined", () => {
    expect(formatOptional(undefined)).toBe("—");
    expect(formatOptional(null)).toBe("—");
    expect(formatOptional("yes")).toBe("yes");
    expect(formatOptional(42)).toBe("42");
    expect(formatOptional(true)).toBe("yes");
    expect(formatOptional(false)).toBe("no");
  });

  test("formatStatusLabel humanizes the status enum", () => {
    expect(formatStatusLabel("ready")).toBe("ready");
    expect(formatStatusLabel("initializing")).toBe("initializing");
    expect(formatStatusLabel("error")).toBe("error");
    expect(formatStatusLabel("degraded")).toBe("degraded");
  });
});

describe("buildStatsSections", () => {
  test("produces all sections for rich stats", () => {
    const sections = buildStatsSections(richStats);
    const titles = sections.map((section) => section.title);
    expect(titles).toEqual([
      "Overview",
      "Vectors",
      "Index (HNSW)",
      "Quantization",
      "Sharding",
      "Payload indexes",
      "Aliases",
    ]);
  });

  test("overview surfaces counts and optimizer state", () => {
    const [overview] = buildStatsSections(richStats);
    expect(overview?.rows).toEqual([
      { label: "Status", value: "ready" },
      { label: "Optimizer", value: "ok" },
      { label: "Points", value: "18,820" },
      { label: "Indexed vectors", value: "18,828" },
      { label: "Segments", value: "2" },
    ]);
  });

  test("vectors and index sections show primitives", () => {
    const sections = buildStatsSections(richStats);
    const vectors = sections.find((s) => s.title === "Vectors");
    expect(vectors?.rows).toEqual([
      { label: "Dimensions", value: "384" },
      { label: "Metric", value: "cosine" },
      { label: "On disk", value: "no" },
    ]);

    const index = sections.find((s) => s.title === "Index (HNSW)");
    expect(index?.rows).toEqual([
      { label: "m", value: "16" },
      { label: "ef_construct", value: "100" },
      { label: "Full scan threshold", value: "10,000" },
      { label: "On disk", value: "no" },
    ]);
  });

  test("payload indexes show per-field breakdown", () => {
    const sections = buildStatsSections(richStats);
    const payload = sections.find((s) => s.title === "Payload indexes");
    expect(payload?.rows).toEqual([
      { label: "text", value: "text · 18,725" },
      { label: "sections", value: "keyword" },
    ]);
  });

  test("aliases section lists alias names", () => {
    const sections = buildStatsSections(richStats);
    const aliases = sections.find((s) => s.title === "Aliases");
    expect(aliases?.rows).toEqual([
      { label: "current", value: "" },
      { label: "live", value: "" },
    ]);
  });

  test("minimal stats omit sections that are missing", () => {
    const titles = buildStatsSections(minimalStats).map((s) => s.title);
    expect(titles).toEqual(["Overview", "Vectors"]);
  });

  test("optimizer with error surfaces the message", () => {
    const sections = buildStatsSections({
      ...minimalStats,
      optimizerStatus: { ok: false, message: "segment overflow" },
    });
    const overview = sections.find((s) => s.title === "Overview");
    expect(overview?.rows).toContainEqual({ label: "Optimizer", value: "error: segment overflow" });
  });
});
