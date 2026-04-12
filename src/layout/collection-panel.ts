import { clamp, formatCount, pad } from "../format";

export const minCollectionPanelWidth = 30;
export const defaultCollectionPanelWidth = 42;
export const maxCollectionPanelWidth = 72;

const collectionPanelResizeStep = 4;
const collectionPanelHorizontalChromeWidth = 4;
const collectionRowFixedColumnWidth = 14;
const minCollectionNameColumnWidth = 8;
const maxCollectionNameColumnWidth = 54;

interface CollectionPanelRowData {
  count: number;
  dimensions: number;
  name: string;
}

export function resizeCollectionPanelWidth(width: number, delta: number): number {
  return clamp(
    width + delta * collectionPanelResizeStep,
    minCollectionPanelWidth,
    maxCollectionPanelWidth,
  );
}

export function collectionNameColumnWidth(panelWidth: number): number {
  const contentWidth = collectionPanelContentWidth(panelWidth);

  return clamp(
    contentWidth - collectionRowFixedColumnWidth,
    minCollectionNameColumnWidth,
    maxCollectionNameColumnWidth,
  );
}

export function collectionPanelContentWidth(panelWidth: number): number {
  return Math.max(0, panelWidth - collectionPanelHorizontalChromeWidth);
}

export function formatCollectionPanelRow(
  collection: CollectionPanelRowData,
  selected: boolean,
  panelWidth: number,
): string {
  const marker = selected ? "> " : "  ";
  const name = pad(collection.name, collectionNameColumnWidth(panelWidth));
  const count = pad(formatCount(collection.count), 5);
  const dimensions = pad(`${collection.dimensions}d`, 5);

  return `${marker}${name} ${count} ${dimensions}`;
}
