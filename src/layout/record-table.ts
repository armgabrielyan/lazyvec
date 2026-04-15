import type { VectorRecord } from "../adapters/types";
import { clamp, pad } from "../format";
import type { TableSchema } from "./metadata-schema";

const nonRecordRowHeight = 22;
export const idColumnWidth = 15;
const columnSeparator = "  ";
const minColumnWidth = 4;

export function formatRecordTableRow(
  record: VectorRecord,
  selected: boolean,
  schema: TableSchema,
  contentWidth?: number,
  precomputedWidths?: number[],
): string {
  const prefix = selected ? "> " : "  ";
  const id = pad(record.id, 12);

  if (schema.columns.length === 0 || contentWidth === undefined) {
    const fallback = formatScalarFallback(record.metadata);
    const labelWidth = contentWidth === undefined ? fallback.length : Math.max(1, contentWidth - idColumnWidth);
    return `${prefix}${id} ${pad(fallback, labelWidth)}`;
  }

  const columnWidths = precomputedWidths ?? distributeColumnWidths(schema, contentWidth - idColumnWidth);
  const cells = schema.columns.map((col, i) => pad(formatCellValue(record.metadata[col.name]), columnWidths[i]!));

  return `${prefix}${id} ${cells.join(columnSeparator)}`;
}

export function formatTableHeader(schema: TableSchema, contentWidth: number, precomputedWidths?: number[]): string {
  const idHeader = pad("ID", 12);

  if (schema.columns.length === 0) {
    return `  ${idHeader} ${pad("", Math.max(1, contentWidth - idColumnWidth))}`;
  }

  const columnWidths = precomputedWidths ?? distributeColumnWidths(schema, contentWidth - idColumnWidth);
  const headers = schema.columns.map((col, i) => pad(col.name, columnWidths[i]!));

  return `  ${idHeader} ${headers.join(columnSeparator)}`;
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

export function distributeColumnWidths(schema: TableSchema, availableWidth: number): number[] {
  const columns = schema.columns;
  const separatorTotal = (columns.length - 1) * columnSeparator.length;
  const distributable = Math.max(columns.length * minColumnWidth, availableWidth - separatorTotal);

  const maxHint = Math.floor(distributable * 0.4);
  const hints = columns.map((col) => Math.min(maxHint, Math.max(col.name.length, col.avgValueLength, minColumnWidth)));
  const totalHint = hints.reduce((sum, h) => sum + h, 0);

  const widths = hints.map((hint) => {
    const proportion = totalHint > 0 ? hint / totalHint : 1 / columns.length;
    return Math.max(minColumnWidth, Math.floor(proportion * distributable));
  });

  let remainder = distributable - widths.reduce((sum, w) => sum + w, 0);
  for (let i = 0; remainder > 0 && i < widths.length; i++) {
    widths[i]!++;
    remainder--;
  }

  return widths;
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }

  if (typeof value === "string") {
    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized.length === 0 ? "-" : normalized;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "-";
}

function formatScalarFallback(metadata: Record<string, unknown>): string {
  for (const value of Object.values(metadata)) {
    if (typeof value === "string") {
      const normalized = value.replace(/\s+/g, " ").trim();
      if (normalized.length > 0) {
        return normalized;
      }
    }

    if (typeof value === "number") {
      return String(value);
    }
  }

  return "-";
}
