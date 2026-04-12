import { describe, expect, test } from "bun:test";
import {
  collectionPanelEmptyMessage,
  formatStatusBarText,
  recordTableEmptyMessage,
} from "./view-state";

describe("view state copy", () => {
  test("formats status state with error taking precedence over loading", () => {
    expect(
      formatStatusBarText({
        error: null,
        focusedPanel: "records",
        loading: true,
        screen: "main",
        status: "Loading records from rag_chunks...",
      }),
    ).toBe("main:records  loading  Loading records from rag_chunks...");

    expect(
      formatStatusBarText({
        error: "Bad Request",
        focusedPanel: "records",
        loading: false,
        screen: "main",
        status: "Bad Request",
      }),
    ).toBe("main:records  error  Bad Request");
  });

  test("uses explicit empty and loading copy for panels", () => {
    expect(collectionPanelEmptyMessage({ collectionCount: 0, loading: true })).toBe("Loading collections...");
    expect(collectionPanelEmptyMessage({ collectionCount: 0, loading: false })).toBe("No collections found.");
    expect(collectionPanelEmptyMessage({ collectionCount: 1, loading: true })).toBeNull();

    expect(recordTableEmptyMessage({ recordCount: 0, loading: true })).toBe("Loading records...");
    expect(recordTableEmptyMessage({ recordCount: 0, loading: false })).toBe("No records in this collection.");
    expect(recordTableEmptyMessage({ recordCount: 1, loading: true })).toBeNull();
  });
});
