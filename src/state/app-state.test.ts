import { describe, expect, test } from "bun:test";
import {
  applyTextEditKey,
  appReducer,
  createInitialState,
  emptyFormFields,
  routePaste,
  type AppState,
} from "./app-state";
import { connectionFormFieldKeys } from "../components/ConnectionForm";
import type { ConnectionProfile } from "../types";

function formOpenedState(fields = emptyFormFields): AppState {
  const base = createInitialState([]);
  return appReducer(base, { type: "OPEN_CONNECTION_FORM", mode: { kind: "add" }, fields });
}

describe("collection stats reducer", () => {
  test("initial state defaults to the records tab with empty stats cache", () => {
    const state = createInitialState([]);
    expect(state.activeRightTab).toBe("records");
    expect(state.collectionStats).toEqual({});
    expect(state.statsLoading).toBe(false);
    expect(state.statsError).toBeNull();
  });

  test("SET_RIGHT_TAB switches tabs without altering stats", () => {
    const state = createInitialState([]);
    const onStats = appReducer(state, { type: "SET_RIGHT_TAB", tab: "stats" });
    expect(onStats.activeRightTab).toBe("stats");
    const backToRecords = appReducer(onStats, { type: "SET_RIGHT_TAB", tab: "records" });
    expect(backToRecords.activeRightTab).toBe("records");
  });

  test("STATS_LOAD lifecycle caches result per collection", () => {
    const base = createInitialState([]);
    const loading = appReducer(base, { type: "STATS_LOAD_START" });
    expect(loading.statsLoading).toBe(true);
    expect(loading.statsError).toBeNull();

    const success = appReducer(loading, {
      type: "STATS_LOAD_SUCCESS",
      collectionName: "rag_chunks",
      stats: {
        status: "ready",
        counts: { points: 10 },
        vectorConfig: { dimensions: 4, metric: "cosine" },
      },
    });

    expect(success.statsLoading).toBe(false);
    expect(success.collectionStats["rag_chunks"]).toBeDefined();
    expect(success.collectionStats["rag_chunks"]?.counts.points).toBe(10);
  });

  test("STATS_LOAD_FAILURE records the error without wiping cache", () => {
    const base = appReducer(createInitialState([]), {
      type: "STATS_LOAD_SUCCESS",
      collectionName: "rag_chunks",
      stats: {
        status: "ready",
        counts: { points: 10 },
        vectorConfig: { dimensions: 4, metric: "cosine" },
      },
    });
    const failed = appReducer(base, { type: "STATS_LOAD_FAILURE", error: "boom" });
    expect(failed.statsLoading).toBe(false);
    expect(failed.statsError).toBe("boom");
    expect(failed.collectionStats["rag_chunks"]).toBeDefined();
  });

  test("SET_RIGHT_TAB to stats moves focus from records to stats", () => {
    const base: AppState = { ...createInitialState([]), focusedPanel: "records" };
    const toStats = appReducer(base, { type: "SET_RIGHT_TAB", tab: "stats" });
    expect(toStats.focusedPanel).toBe("stats");
    const backToRecords = appReducer(toStats, { type: "SET_RIGHT_TAB", tab: "records" });
    expect(backToRecords.focusedPanel).toBe("records");
  });

  test("SET_RIGHT_TAB leaves focus unchanged when on another panel", () => {
    const base: AppState = { ...createInitialState([]), focusedPanel: "inspector" };
    const toStats = appReducer(base, { type: "SET_RIGHT_TAB", tab: "stats" });
    expect(toStats.focusedPanel).toBe("inspector");
  });

  test("CYCLE_FOCUS includes stats panel when stats tab is active", () => {
    const base: AppState = { ...createInitialState([]), activeRightTab: "stats", focusedPanel: "collections" };
    const afterOne = appReducer(base, { type: "CYCLE_FOCUS", delta: 1 });
    expect(afterOne.focusedPanel).toBe("stats");
    const afterTwo = appReducer(afterOne, { type: "CYCLE_FOCUS", delta: 1 });
    expect(afterTwo.focusedPanel).toBe("inspector");
    const afterThree = appReducer(afterTwo, { type: "CYCLE_FOCUS", delta: 1 });
    expect(afterThree.focusedPanel).toBe("collections");
  });

  test("INVALIDATE_STATS removes cached entries for the named collections", () => {
    const seeded: AppState = {
      ...createInitialState([]),
      collectionStats: {
        rag_chunks: {
          status: "ready",
          counts: { points: 10 },
          vectorConfig: { dimensions: 4, metric: "cosine" },
        },
        products: {
          status: "ready",
          counts: { points: 5 },
          vectorConfig: { dimensions: 4, metric: "cosine" },
        },
      },
    };

    const invalidated = appReducer(seeded, {
      type: "INVALIDATE_STATS",
      collectionNames: ["rag_chunks"],
    });

    expect(invalidated.collectionStats["rag_chunks"]).toBeUndefined();
    expect(invalidated.collectionStats["products"]).toBeDefined();
  });
});

describe("connection form reducer", () => {
  test("form field keys include apiKey after url", () => {
    expect(connectionFormFieldKeys).toEqual(["name", "provider", "url", "apiKey"]);
  });

  test("empty form fields include blank apiKey", () => {
    expect(emptyFormFields).toEqual({ name: "", provider: "qdrant", url: "", apiKey: "" });
  });

  test("OPEN_CONNECTION_FORM initializes cursor for apiKey", () => {
    const state = formOpenedState({ name: "cloud", provider: "qdrant", url: "https://x", apiKey: "sk-1" });
    expect(state.connectionFormCursors).toEqual([5, 0, 9, 4]);
  });

  test("CYCLE_CONNECTION_FORM_FOCUS wraps through 4 fields", () => {
    const opened = formOpenedState();
    const afterThree = [1, 2, 3].reduce(
      (s) => appReducer(s, { type: "CYCLE_CONNECTION_FORM_FOCUS", delta: 1 }),
      opened,
    );
    expect(afterThree.connectionFormFocusedField).toBe(3);

    const afterFour = appReducer(afterThree, { type: "CYCLE_CONNECTION_FORM_FOCUS", delta: 1 });
    expect(afterFour.connectionFormFocusedField).toBe(0);
  });

  test("CYCLE_CONNECTION_FORM_PROVIDER toggles between qdrant and pinecone", () => {
    const opened = formOpenedState();
    const next = appReducer(opened, { type: "CYCLE_CONNECTION_FORM_PROVIDER", delta: 1 });
    expect(next.connectionFormFields.provider).toBe("pinecone");

    const wrapped = appReducer(next, { type: "CYCLE_CONNECTION_FORM_PROVIDER", delta: 1 });
    expect(wrapped.connectionFormFields.provider).toBe("qdrant");

    const back = appReducer(next, { type: "CYCLE_CONNECTION_FORM_PROVIDER", delta: -1 });
    expect(back.connectionFormFields.provider).toBe("qdrant");
  });

  test("UPDATE_CONNECTION_FORM_FIELD can set apiKey at index 3", () => {
    const opened = formOpenedState();
    const updated = appReducer(opened, {
      type: "UPDATE_CONNECTION_FORM_FIELD",
      fieldIndex: 3,
      value: "sk-123",
      cursor: 6,
    });

    expect(updated.connectionFormFields.apiKey).toBe("sk-123");
    expect(updated.connectionFormCursors[3]).toBe(6);
  });

  test("SAVE_CONNECTION_SUCCESS resets cursors to 4 zeros", () => {
    const opened = formOpenedState({ name: "a", provider: "qdrant", url: "b", apiKey: "c" });
    const saved = appReducer(opened, { type: "SAVE_CONNECTION_SUCCESS", connections: [] });
    expect(saved.connectionFormCursors).toEqual([0, 0, 0, 0]);
    expect(saved.connectionFormFields).toEqual(emptyFormFields);
  });

  test("initial state cursors have 4 entries", () => {
    const state = createInitialState([] as ConnectionProfile[]);
    expect(state.connectionFormCursors).toEqual([0, 0, 0, 0]);
  });
});

describe("applyTextEditKey", () => {
  test("inserts a single printable char", () => {
    expect(applyTextEditKey({ sequence: "x" }, "ab", 1)).toEqual({ value: "axb", cursor: 2 });
  });

  test("inserts a pasted multi-char sequence at the cursor", () => {
    expect(applyTextEditKey({ sequence: "hello" }, "", 0)).toEqual({ value: "hello", cursor: 5 });
  });

  test("inserts a paste in the middle of existing text", () => {
    expect(applyTextEditKey({ sequence: "XY" }, "ab", 1)).toEqual({ value: "aXYb", cursor: 3 });
  });

  test("strips bracketed-paste escape markers from the sequence", () => {
    const pasted = "\x1b[200~sk-abc\x1b[201~";
    expect(applyTextEditKey({ sequence: pasted }, "", 0)).toEqual({ value: "sk-abc", cursor: 6 });
  });

  test("strips control characters (newlines, tabs, escape)", () => {
    expect(applyTextEditKey({ sequence: "ab\nc\td\x1be" }, "", 0)).toEqual({ value: "abcde", cursor: 5 });
  });

  test("truncates pastes to maxLength", () => {
    expect(applyTextEditKey({ sequence: "sk-1234567890", sequence_length: 13 } as never, "ab", 2, 6)).toEqual({
      value: "absk-1",
      cursor: 6,
    });
  });

  test("returns null when a paste contains only control chars", () => {
    expect(applyTextEditKey({ sequence: "\x1b\x00\x7f" }, "a", 1)).toBeNull();
  });

  test("ignores ctrl+key combos", () => {
    expect(applyTextEditKey({ sequence: "a", ctrl: true }, "", 0)).toBeNull();
  });
});

describe("routePaste", () => {
  test("routes paste into focused connection form field", () => {
    const base = createInitialState([]);
    const state = appReducer(base, {
      type: "OPEN_CONNECTION_FORM",
      mode: { kind: "add" },
      fields: { name: "", provider: "qdrant", url: "https://", apiKey: "" },
    });
    const atUrl = appReducer(state, { type: "CYCLE_CONNECTION_FORM_FOCUS", delta: 2 });

    expect(routePaste(atUrl, "example.com")).toEqual({
      type: "UPDATE_CONNECTION_FORM_FIELD",
      fieldIndex: 2,
      value: "https://example.com",
      cursor: 19,
    });
  });

  test("routes paste into apiKey field", () => {
    const base = createInitialState([]);
    const opened = appReducer(base, {
      type: "OPEN_CONNECTION_FORM",
      mode: { kind: "add" },
      fields: emptyFormFields,
    });
    const atApiKey = appReducer(opened, { type: "CYCLE_CONNECTION_FORM_FOCUS", delta: 3 });

    expect(routePaste(atApiKey, "sk-cloud-secret")).toEqual({
      type: "UPDATE_CONNECTION_FORM_FIELD",
      fieldIndex: 3,
      value: "sk-cloud-secret",
      cursor: 15,
    });
  });

  test("ignores paste when focused on read-only provider field", () => {
    const base = createInitialState([]);
    const opened = appReducer(base, {
      type: "OPEN_CONNECTION_FORM",
      mode: { kind: "add" },
      fields: emptyFormFields,
    });
    const atProvider = appReducer(opened, { type: "CYCLE_CONNECTION_FORM_FOCUS", delta: 1 });

    expect(routePaste(atProvider, "pinecone")).toBeNull();
  });

  test("routes paste into open filter input", () => {
    const base = createInitialState([]);
    const opened = appReducer(base, { type: "OPEN_FILTER" });

    expect(routePaste(opened, "source:wiki")).toEqual({
      type: "UPDATE_FILTER_INPUT",
      value: "source:wiki",
      cursor: 11,
    });
  });

  test("returns null when no text target is focused", () => {
    const state = createInitialState([]);
    expect(routePaste(state, "hello")).toBeNull();
  });

  test("returns null for paste of only control chars", () => {
    const base = createInitialState([]);
    const opened = appReducer(base, { type: "OPEN_FILTER" });
    expect(routePaste(opened, "\x1b\x00")).toBeNull();
  });
});
