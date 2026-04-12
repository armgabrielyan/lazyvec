import { describe, expect, test } from "bun:test";
import {
  formatRecordTableHeader,
  formatRecordTableRow,
  recordTableLabelWidth,
  metadataLabel,
  metadataSummary,
  recordTableVisibleRowCount,
  visibleRecordWindow,
} from "./record-table";

describe("record table layout", () => {
  test("formats rows with a label and payload field count", () => {
    expect(
      formatRecordTableRow(
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
      ),
    ).toBe("> 49           Chris Dyer                   4 fields");
  });

  test("widens the label column when the records panel has room", () => {
    const record = {
      id: "49",
      metadata: {
        file_name: "662a3ac7847574fa510569_Chris_Dyer_V6_p.jpeg",
        url: "/styles/chris-dyer",
      },
      vector: null,
    };

    expect(recordTableLabelWidth(56)).toBe(28);
    expect(recordTableLabelWidth(120)).toBe(80);
    expect(formatRecordTableHeader(120)).toBe(`${"ID".padEnd(14)} ${"Label".padEnd(80)} Payload`);
    expect(formatRecordTableRow(record, true, 120)).toBe(
      `> 49           ${"662a3ac7847574fa510569_Chris_Dyer_V6_p.jpeg".padEnd(80)} 2 fields`,
    );
  });

  test("finds useful metadata labels from preferred keys and regex patterns", () => {
    expect(metadataLabel({ name: "Chris Dyer", file_name: "662a3.jpeg" })).toBe("Chris Dyer");
    expect(metadataLabel({ display_name: "Catherine Hyde" })).toBe("Catherine Hyde");
    expect(metadataLabel({ file_name: "662a302_Catherine_Hyde_V6_p.jpeg" })).toBe("662a302_Catherine_Hyde_V6_p.jpeg");
    expect(metadataLabel({ document_title: "Embeddings guide", chunk_index: 3 })).toBe("Embeddings guide");
  });

  test("does not use noisy long fields as labels", () => {
    expect(metadataLabel({ image_url: "https://example.com/image.png", payload: { nested: true } })).toBe("-");
  });

  test("summarizes payloads without rendering raw JSON", () => {
    expect(metadataSummary({})).toBe("empty");
    expect(metadataSummary({ name: "Chris Dyer" })).toBe("1 field");
    expect(metadataSummary({ nested: { value: true }, image_url: "https://example.com/image.png" })).toBe("2 fields");
    expect(metadataSummary({ score: 0.42, active: true })).toBe("2 fields");
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
