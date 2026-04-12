import { describe, expect, test } from "bun:test";
import { formatRecordTableRow, recordTableVisibleRowCount, visibleRecordWindow } from "./record-table";

describe("record table layout", () => {
  test("formats rows with fixed id and dimension columns", () => {
    expect(
      formatRecordTableRow(
        {
          id: "49",
          metadata: {
            file_name: "662c5.png",
          },
          vector: null,
        },
        512,
        true,
      ),
    ).toBe("> 49           512   {\"file_name\":\"662c5...");
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
