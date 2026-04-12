import type { VectorRecord } from "../adapters/types";
import { clamp, metadataPreview, pad } from "../format";

const nonRecordRowHeight = 22;

export function formatRecordTableRow(
  record: VectorRecord,
  collectionDimensions: number,
  selected: boolean,
): string {
  return `${selected ? "> " : "  "}${pad(record.id, 12)} ${pad(`${collectionDimensions}`, 5)} ${metadataPreview(record.metadata, 22)}`;
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
