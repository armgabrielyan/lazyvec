import type { VectorRecord } from "../adapters/types";
import { formatVectorPreview, truncate } from "../format";

export function inspectorRecordForSelection(
  inspectedRecord: VectorRecord | null,
  selectedRecord: VectorRecord | null,
): VectorRecord | null {
  return inspectedRecord ?? selectedRecord;
}

export function formatInspectorVectorPreview(vector: number[] | null, maxLength = 40): string {
  if (vector === null) {
    return "press Enter to fetch vector";
  }

  return `[${truncate(formatVectorPreview(vector), maxLength)}, ...]`;
}
