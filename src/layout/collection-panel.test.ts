import { describe, expect, test } from "bun:test";
import {
  collectionPanelContentWidth,
  collectionNameColumnWidth,
  defaultCollectionPanelWidth,
  formatCollectionPanelRow,
  maxCollectionPanelWidth,
  minCollectionPanelWidth,
  resizeCollectionPanelWidth,
} from "./collection-panel";

describe("collection panel layout", () => {
  test("uses a wider default panel for readable collection names", () => {
    expect(defaultCollectionPanelWidth).toBe(42);
  });

  test("resizes in bounded steps", () => {
    expect(resizeCollectionPanelWidth(defaultCollectionPanelWidth, 1)).toBe(46);
    expect(resizeCollectionPanelWidth(defaultCollectionPanelWidth, -1)).toBe(38);
    expect(resizeCollectionPanelWidth(minCollectionPanelWidth, -1)).toBe(minCollectionPanelWidth);
    expect(resizeCollectionPanelWidth(maxCollectionPanelWidth, 1)).toBe(maxCollectionPanelWidth);
  });

  test("derives a bounded collection-name column width from the panel width", () => {
    expect(collectionNameColumnWidth(42)).toBe(24);
    expect(collectionNameColumnWidth(24)).toBe(8);
    expect(collectionNameColumnWidth(90)).toBe(54);
  });

  test("formats rows within the panel content width so OpenTUI does not wrap them", () => {
    const row = formatCollectionPanelRow(
      {
        count: 5_400,
        dimensions: 512,
        name: "midjourney styles",
      },
      true,
      defaultCollectionPanelWidth,
    );

    expect(row).toBe("> midjourney styles        5.4k  512d ");
    expect(row.length).toBeLessThanOrEqual(collectionPanelContentWidth(defaultCollectionPanelWidth));
  });

  test("truncates long collection names before count and dimension columns", () => {
    const row = formatCollectionPanelRow(
      {
        count: 1_234_567,
        dimensions: 1536,
        name: "very long collection name that should not wrap",
      },
      false,
      minCollectionPanelWidth,
    );

    expect(row).toBe("  very long... 1.2m  1536d");
    expect(row.length).toBeLessThanOrEqual(collectionPanelContentWidth(minCollectionPanelWidth));
  });
});
