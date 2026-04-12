import { describe, expect, test } from "bun:test";
import {
  collectionPanelEmptyMessage,
  formatStatusBarText,
  headerParts,
  recordTableEmptyMessage,
  shouldShowStatusBar,
  statusTone,
} from "./view-state";

describe("view state copy", () => {
  test("formats header segments", () => {
    expect(
      headerParts({
        connectionName: "local-qdrant",
      }),
    ).toEqual({
      connectionLabel: "conn:",
      connectionName: "local-qdrant",
    });

    expect(
      headerParts({
        connectionName: null,
      }),
    ).toEqual({
      connectionLabel: "conn:",
      connectionName: null,
    });
  });

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

  test("derives visual status tone", () => {
    expect(statusTone({ error: "Bad Request", loading: true })).toBe("error");
    expect(statusTone({ error: null, loading: true })).toBe("loading");
    expect(statusTone({ error: null, loading: false })).toBe("ready");
  });

  test("hides idle connection-screen status chrome", () => {
    expect(shouldShowStatusBar({ error: null, loading: false, screen: "connections" })).toBe(false);
    expect(shouldShowStatusBar({ error: null, loading: true, screen: "connections" })).toBe(true);
    expect(shouldShowStatusBar({ error: "Bad Request", loading: false, screen: "connections" })).toBe(true);
    expect(shouldShowStatusBar({ error: null, loading: false, screen: "main" })).toBe(true);
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
