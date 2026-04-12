import type { VectorRecord } from "../adapters/types";
import { clamp, formatMetadataValue, formatVectorPreview, pad, truncate } from "../format";

const defaultMetadataKeyWidth = 14;
const defaultMetadataValueWidth = 44;
const maxMetadataValueWidth = 96;
const nonValueWidth = 44;

interface InspectorMetadataLineOptions {
  keyWidth?: number;
  valueWidth?: number;
}

interface InspectorMetadataLinesOptions extends InspectorMetadataLineOptions {
  maxLines?: number;
}

export function inspectorRecordForSelection(
  inspectedRecord: VectorRecord | null,
  selectedRecord: VectorRecord | null,
): VectorRecord | null {
  return inspectedRecord ?? selectedRecord;
}

export function formatInspectorPayloadSummary(metadata: Record<string, unknown>): string {
  const fieldCount = Object.keys(metadata).length;

  if (fieldCount === 0) {
    return "Payload: empty";
  }

  return `Payload: ${fieldCount} ${fieldCount === 1 ? "field" : "fields"}`;
}

export function formatInspectorMetadataLines(
  metadata: Record<string, unknown>,
  options: InspectorMetadataLinesOptions = {},
): string[] {
  const maxLines = options.maxLines ?? 5;

  if (maxLines <= 0) {
    return [];
  }

  const entries = Object.entries(metadata);

  if (entries.length <= maxLines) {
    return entries.map(([key, value]) => formatInspectorMetadataLine(key, value, options));
  }

  const visibleFieldCount = Math.max(0, maxLines - 1);
  const hiddenFieldCount = entries.length - visibleFieldCount;
  const visibleLines = entries
    .slice(0, visibleFieldCount)
    .map(([key, value]) => formatInspectorMetadataLine(key, value, options));

  return [...visibleLines, `  +${hiddenFieldCount} more ${hiddenFieldCount === 1 ? "field" : "fields"}`];
}

export function formatInspectorMetadataLine(
  key: string,
  value: unknown,
  options: InspectorMetadataLineOptions = {},
): string {
  const keyWidth = options.keyWidth ?? defaultMetadataKeyWidth;
  const valueWidth = options.valueWidth ?? defaultMetadataValueWidth;

  return `  ${pad(key, keyWidth)} ${truncate(formatMetadataValue(value), valueWidth)}`;
}

export function inspectorMetadataValueWidth(contentWidth?: number): number {
  if (contentWidth === undefined) {
    return defaultMetadataValueWidth;
  }

  return clamp(contentWidth - nonValueWidth, defaultMetadataValueWidth, maxMetadataValueWidth);
}

export function formatInspectorVectorPreview(vector: number[] | null, maxLength = 40): string {
  if (vector === null) {
    return "press Enter to fetch vector";
  }

  return `[${truncate(formatVectorPreview(vector), maxLength)}, ...]`;
}
