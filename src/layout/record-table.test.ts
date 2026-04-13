import { describe, expect, test } from "bun:test";
import type { TableSchema } from "./metadata-schema";
import {
  formatRecordTableRow,
  formatTableHeader,
  recordTableVisibleRowCount,
  visibleRecordWindow,
} from "./record-table";

const twoColumnSchema: TableSchema = {
  columns: [
    { name: "name", type: "string", nonNullRate: 1.0, avgValueLength: 10, score: 100 },
    { name: "category", type: "string", nonNullRate: 0.8, avgValueLength: 8, score: 80 },
  ],
};

describe("record table layout", () => {
  test("formats rows with ID and dynamic metadata columns", () => {
    const row = formatRecordTableRow(
      {
        id: "49",
        metadata: { name: "Chris Dyer", category: "art" },
        vector: null,
      },
      true,
      twoColumnSchema,
      60,
    );
    expect(row.length).toBe(60);
    expect(row).toContain("49");
    expect(row).toContain("Chris Dyer");
    expect(row).toContain("art");
  });

  test("truncates long column values to fit allocated width", () => {
    const row = formatRecordTableRow(
      {
        id: "1",
        metadata: { name: "A very long name that should be truncated to fit", category: "tech" },
        vector: null,
      },
      false,
      twoColumnSchema,
      40,
    );
    expect(row.length).toBe(40);
    expect(row).toContain("...");
  });

  test("handles missing metadata fields gracefully", () => {
    const row = formatRecordTableRow(
      {
        id: "5",
        metadata: { name: "Alice" },
        vector: null,
      },
      false,
      twoColumnSchema,
      60,
    );
    expect(row.length).toBe(60);
    expect(row).toContain("Alice");
    expect(row).toContain("-");
  });

  test("formats non-string values as strings", () => {
    const schema: TableSchema = {
      columns: [
        { name: "score", type: "number", nonNullRate: 1.0, avgValueLength: 4, score: 100 },
        { name: "active", type: "boolean", nonNullRate: 1.0, avgValueLength: 5, score: 90 },
      ],
    };
    const row = formatRecordTableRow(
      {
        id: "1",
        metadata: { score: 0.95, active: true },
        vector: null,
      },
      false,
      schema,
      60,
    );
    expect(row).toContain("0.95");
    expect(row).toContain("true");
  });

  test("falls back to single label column when schema has no columns", () => {
    const emptySchema: TableSchema = { columns: [] };
    const row = formatRecordTableRow(
      {
        id: "1",
        metadata: { name: "Alice", score: 42 },
        vector: null,
      },
      false,
      emptySchema,
      40,
    );
    expect(row.length).toBe(40);
    expect(row).toContain("1");
  });

  test("selected row starts with > prefix", () => {
    const row = formatRecordTableRow(
      { id: "1", metadata: { name: "A" }, vector: null },
      true,
      twoColumnSchema,
      40,
    );
    expect(row.startsWith("> ")).toBe(true);
  });

  test("unselected row starts with space prefix", () => {
    const row = formatRecordTableRow(
      { id: "1", metadata: { name: "A" }, vector: null },
      false,
      twoColumnSchema,
      40,
    );
    expect(row.startsWith("  ")).toBe(true);
  });

  test("formats table header with column names", () => {
    const header = formatTableHeader(twoColumnSchema, 60);
    expect(header.length).toBe(60);
    expect(header).toContain("ID");
    expect(header).toContain("name");
    expect(header).toContain("category");
  });

  test("formats header for empty schema with just ID", () => {
    const header = formatTableHeader({ columns: [] }, 40);
    expect(header.length).toBe(40);
    expect(header).toContain("ID");
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
