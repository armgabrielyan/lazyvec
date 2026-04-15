export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function formatCount(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}m`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }

  return String(value);
}

export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  if (maxLength <= 3) {
    return value.slice(0, maxLength);
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

export function pad(value: string, width: number): string {
  return truncate(value, width).padEnd(width, " ");
}

export function metadataPreview(metadata: Record<string, unknown>, maxLength = 52): string {
  return truncate(JSON.stringify(metadata), maxLength);
}

export function formatMetadataValue(value: unknown): string {
  if (typeof value === "string") {
    return `"${value}"`;
  }

  return JSON.stringify(value);
}

export function formatVectorPreview(vector: number[]): string {
  return vector.map((value) => value.toFixed(4)).join(", ");
}

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
