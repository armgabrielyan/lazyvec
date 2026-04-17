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
