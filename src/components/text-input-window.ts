export interface TextWindow {
  visible: string;
  localCursor: number;
}

export function visibleTextWindow(value: string, cursor: number, width: number): TextWindow {
  const clampedCursor = Math.max(0, Math.min(value.length, cursor));

  if (value.length <= width) {
    return { visible: value, localCursor: clampedCursor };
  }

  let start = Math.max(0, clampedCursor - width + 1);
  if (start + width > value.length) {
    start = value.length - width;
  }

  return {
    visible: value.slice(start, start + width),
    localCursor: clampedCursor - start,
  };
}
