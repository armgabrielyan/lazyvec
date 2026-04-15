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

  test("formats footer text as message only", () => {
    expect(
      formatStatusBarText({
        status: "End of collection.",
      }),
    ).toBe("End of collection.");

    expect(
      formatStatusBarText({
        status: "Bad Request",
      }),
    ).toBe("Bad Request");
  });

  test("derives visual status tone", () => {
    expect(statusTone({ error: "Bad Request", loading: true })).toBe("error");
    expect(statusTone({ error: null, loading: true })).toBe("loading");
    expect(statusTone({ error: null, loading: false })).toBe("ready");
  });

  test("hides idle connection-screen status chrome", () => {
    expect(shouldShowStatusBar({ error: null, status: "" })).toBe(false);
    expect(shouldShowStatusBar({ error: null, status: "" })).toBe(false);
    expect(shouldShowStatusBar({ error: null, status: "Connecting..." })).toBe(true);
    expect(shouldShowStatusBar({ error: "Bad Request", status: "" })).toBe(true);
    expect(shouldShowStatusBar({ error: null, status: "End of collection." })).toBe(true);
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
