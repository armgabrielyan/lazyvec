import type { VectorRecord } from "../adapters/types";
import { formatMetadataValue, formatVectorPreview, truncate } from "../format";

export function inspectorRecordForSelection(
  inspectedRecord: VectorRecord | null,
  selectedRecord: VectorRecord | null,
): VectorRecord | null {
  return inspectedRecord ?? selectedRecord;
}

export function formatInspectorMetadataLine(key: string, value: unknown, maxLength = 32): string {
  return `  ${key}: ${truncate(formatMetadataValue(value), maxLength)}`;
}

export function formatInspectorVectorPreview(vector: number[] | null, maxLength = 40): string {
  if (vector === null) {
    return "press Enter to fetch vector";
  }

  return `[${truncate(formatVectorPreview(vector), maxLength)}, ...]`;
}
