import type { VectorRecord } from "../adapters/types";

const maxColumns = 8;

const noisyFieldPattern =
  /(^|[_-])(image[_-]?url|thumbnail|avatar|icon|vector|embedding|text|content|body)($|[_-])/i;

export type FieldType = "string" | "number" | "boolean";

export interface FieldSchema {
  name: string;
  type: FieldType;
  nonNullRate: number;
  avgValueLength: number;
  score: number;
}

export interface TableSchema {
  columns: FieldSchema[];
}

interface FieldStats {
  typeCounts: Record<string, number>;
  nonNullCount: number;
  totalValueLength: number;
  valueCount: number;
}

export function inferTableSchema(records: VectorRecord[]): TableSchema {
  if (records.length === 0) {
    return { columns: [] };
  }

  const fieldMap = new Map<string, FieldStats>();

  for (const record of records) {
    for (const [key, value] of Object.entries(record.metadata)) {
      let stats = fieldMap.get(key);
      if (!stats) {
        stats = { typeCounts: {}, nonNullCount: 0, totalValueLength: 0, valueCount: 0 };
        fieldMap.set(key, stats);
      }

      if (value === null || value === undefined) {
        continue;
      }

      const type = Array.isArray(value) ? "array" : typeof value;
      stats.typeCounts[type] = (stats.typeCounts[type] ?? 0) + 1;
      stats.nonNullCount++;

      if (typeof value === "string") {
        stats.totalValueLength += value.length;
      } else if (typeof value === "number") {
        stats.totalValueLength += String(value).length;
      } else if (typeof value === "boolean") {
        stats.totalValueLength += value ? 4 : 5;
      }
      stats.valueCount++;
    }
  }

  const columns: FieldSchema[] = [];

  for (const [name, stats] of fieldMap) {
    if (noisyFieldPattern.test(name)) {
      continue;
    }

    const dominantType = getDominantType(stats.typeCounts);
    if (!dominantType) {
      continue;
    }

    const nonNullRate = stats.nonNullCount / records.length;
    const avgValueLength = stats.valueCount > 0 ? stats.totalValueLength / stats.valueCount : 0;
    const score = scoreField(nonNullRate, avgValueLength, dominantType);

    columns.push({ name, type: dominantType, nonNullRate, avgValueLength, score });
  }

  columns.sort((a, b) => b.score - a.score);

  return { columns: columns.slice(0, maxColumns) };
}

function getDominantType(typeCounts: Record<string, number>): FieldType | null {
  const scalarTypes: FieldType[] = ["string", "number", "boolean"];

  let best: FieldType | null = null;
  let bestCount = 0;

  for (const type of scalarTypes) {
    const count = typeCounts[type] ?? 0;
    if (count > bestCount) {
      best = type;
      bestCount = count;
    }
  }

  return best;
}

function scoreField(nonNullRate: number, avgValueLength: number, type: FieldType): number {
  let score = nonNullRate * 100;

  // Prefer short values — long strings (URLs, paragraphs) are less useful as columns
  if (type === "string" && avgValueLength > 50) {
    score -= 20;
  }

  // Slight type preference: strings > numbers > booleans for column display
  if (type === "number") {
    score -= 2;
  } else if (type === "boolean") {
    score -= 5;
  }

  return score;
}
