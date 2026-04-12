import { describe, expect, test } from "bun:test";
import type { VectorRecord } from "../adapters/types";
import {
  formatInspectorVectorPreview,
  inspectorRecordForSelection,
} from "./inspector";

describe("inspector layout", () => {
  test("shows the selected record until a fetched inspected record exists", () => {
    const selectedRecord: VectorRecord = {
      id: "selected",
      metadata: { name: "Selected" },
      vector: null,
    };
    const inspectedRecord: VectorRecord = {
      id: "inspected",
      metadata: { name: "Inspected" },
      vector: [0.1, 0.2],
    };

    expect(inspectorRecordForSelection(null, selectedRecord)).toBe(selectedRecord);
    expect(inspectorRecordForSelection(inspectedRecord, selectedRecord)).toBe(inspectedRecord);
    expect(inspectorRecordForSelection(null, null)).toBeNull();
  });

  test("describes vector state before and after explicit inspection", () => {
    expect(formatInspectorVectorPreview(null)).toBe("press Enter to fetch vector");
    expect(formatInspectorVectorPreview([0.123456, 0.2])).toBe("[0.1235, 0.2000, ...]");
  });
});
