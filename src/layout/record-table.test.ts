import { describe, expect, test } from "bun:test";
import {
  formatRecordTableHeader,
  formatRecordTableRow,
  metadataLabel,
  recordTableVisibleRowCount,
  visibleRecordWindow,
} from "./record-table";

describe("record table layout", () => {
  test("formats rows with ID and label padded to content width", () => {
    const row = formatRecordTableRow(
      {
        id: "49",
        metadata: {
          file_name: "662a3ac7847574fa510569_Chris_Dyer_V6_p.jpeg",
          image_url: "https://storage.googleapis.com/demo-midjourney/images/662a3ac7847574fa510569.jpeg",
          name: "Chris Dyer",
          url: "/styles/chris-dyer",
        },
        vector: null,
      },
      true,
      60,
    );
    expect(row).toBe(`> 49           ${"Chris Dyer".padEnd(45)}`);
    expect(row.length).toBe(60);
  });

  test("truncates long labels to fit content width", () => {
    const row = formatRecordTableRow(
      {
        id: "1",
        metadata: { name: "A very long name that should be truncated to fit the panel" },
        vector: null,
      },
      false,
      40,
    );
    expect(row.length).toBe(40);
    expect(row).toContain("A very long name that ...");
  });

  test("header matches row column layout", () => {
    expect(formatRecordTableHeader()).toBe("ID             Label");
  });

  test("finds useful metadata labels from preferred keys and regex patterns", () => {
    expect(metadataLabel({ name: "Chris Dyer", file_name: "662a3.jpeg" })).toBe("Chris Dyer");
    expect(metadataLabel({ display_name: "Catherine Hyde" })).toBe("Catherine Hyde");
    expect(metadataLabel({ file_name: "662a302_Catherine_Hyde_V6_p.jpeg" })).toBe("662a302_Catherine_Hyde_V6_p.jpeg");
    expect(metadataLabel({ document_title: "Embeddings guide", chunk_index: 3 })).toBe("Embeddings guide");
  });

  test("matches broader descriptive keys via regex", () => {
    expect(metadataLabel({ description: "A short summary" })).toBe("A short summary");
    expect(metadataLabel({ category: "sports" })).toBe("sports");
    expect(metadataLabel({ topic: "machine learning" })).toBe("machine learning");
    expect(metadataLabel({ query: "how to embed text" })).toBe("how to embed text");
    expect(metadataLabel({ prefix: "&" })).toBe("&");
    expect(metadataLabel({ chunk_id: "chunk-42" })).toBe("chunk-42");
    expect(metadataLabel({ doc_type: "article" })).toBe("article");
  });

  test("skips noisy keys but falls back to first scalar value", () => {
    expect(metadataLabel({ image_url: "https://example.com/image.png", payload: { nested: true } })).toBe("https://example.com/image.png");
  });

  test("falls back to first scalar value when no key pattern matches", () => {
    expect(metadataLabel({ prefix: "&" })).toBe("&");
    expect(metadataLabel({ score: 0.95, data: { nested: true } })).toBe("0.95");
    expect(metadataLabel({ nested: { a: 1 }, list: [1, 2] })).toBe("-");
  });

  test("derives a conservative visible row count from terminal height", () => {
    expect(recordTableVisibleRowCount(50)).toBe(28);
    expect(recordTableVisibleRowCount(20)).toBe(5);
  });

  test("keeps the selected record visible without resetting to the top", () => {
    const records = Array.from({ length: 100 }, (_, index) => index + 1);

    expect(visibleRecordWindow(records, 0, 10)).toEqual({
      records: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      startIndex: 0,
    });
    expect(visibleRecordWindow(records, 50, 10)).toEqual({
      records: [42, 43, 44, 45, 46, 47, 48, 49, 50, 51],
      startIndex: 41,
    });
  });
});
