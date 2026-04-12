import type { VectorRecord } from "../adapters/types";
import { clamp, pad } from "../format";

const nonRecordRowHeight = 22;
const exactLabelKeys = ["name", "title", "label", "caption", "file_name", "filename", "source", "url", "path", "slug"];
const labelKeyPatterns = [
  /(^|[_-])(display[_-]?name|name|title|label|caption)($|[_-])/i,
  /(^|[_-])(file[_-]?name|filename|source|url|path|slug)($|[_-])/i,
];
const noisyLabelKeyPattern = /(^|[_-])(image[_-]?url|thumbnail|avatar|icon|vector|embedding|text|content|body)($|[_-])/i;

export function formatRecordTableRow(record: VectorRecord, selected: boolean): string {
  return `${selected ? "> " : "  "}${pad(record.id, 12)} ${metadataLabel(record.metadata)}`;
}

export function formatRecordTableHeader(): string {
  return `${pad("ID", 14)} Label`;
}


export function metadataLabel(metadata: Record<string, unknown>): string {
  for (const key of exactLabelKeys) {
    const value = metadata[key];
    const label = labelPart(value);

    if (label !== null) {
      return label;
    }
  }

  for (const [key, value] of Object.entries(metadata)) {
    if (noisyLabelKeyPattern.test(key)) {
      continue;
    }

    if (!labelKeyPatterns.some((pattern) => pattern.test(key))) {
      continue;
    }

    const label = labelPart(value);

    if (label !== null) {
      return label;
    }
  }

  return "-";
}


export function recordTableVisibleRowCount(terminalHeight: number): number {
  return Math.max(5, terminalHeight - nonRecordRowHeight);
}

export function visibleRecordWindow<T>(
  records: T[],
  selectedIndex: number,
  maxVisibleRows: number,
): {
  records: T[];
  startIndex: number;
} {
  if (records.length === 0) {
    return {
      records: [],
      startIndex: 0,
    };
  }

  const rowCount = clamp(maxVisibleRows, 1, records.length);
  const selected = clamp(selectedIndex, 0, records.length - 1);
  const startIndex = clamp(selected - rowCount + 1, 0, records.length - rowCount);

  return {
    records: records.slice(startIndex, startIndex + rowCount),
    startIndex,
  };
}

function labelPart(value: unknown): string | null {
  if (typeof value === "string") {
    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized.length === 0 ? null : normalized;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}
