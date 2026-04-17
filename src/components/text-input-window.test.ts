import { describe, expect, test } from "bun:test";
import { visibleTextWindow } from "./text-input-window";

describe("visibleTextWindow", () => {
  test("returns whole value when it fits within width", () => {
    expect(visibleTextWindow("hello", 3, 10)).toEqual({ visible: "hello", localCursor: 3 });
  });

  test("returns empty value unchanged", () => {
    expect(visibleTextWindow("", 0, 10)).toEqual({ visible: "", localCursor: 0 });
  });

  test("scrolls so cursor stays within window when value exceeds width", () => {
    const value = "abcdefghij"; // length 10
    expect(visibleTextWindow(value, 9, 5)).toEqual({ visible: "fghij", localCursor: 4 });
  });

  test("cursor at start of long value shows leading window", () => {
    const value = "abcdefghij";
    expect(visibleTextWindow(value, 0, 5)).toEqual({ visible: "abcde", localCursor: 0 });
  });

  test("cursor past end of value clamps to end", () => {
    const value = "abcdefghij";
    expect(visibleTextWindow(value, 10, 5)).toEqual({ visible: "fghij", localCursor: 5 });
  });

  test("cursor in middle of long value keeps it near the right edge", () => {
    const value = "abcdefghij";
    expect(visibleTextWindow(value, 6, 4)).toEqual({ visible: "defg", localCursor: 3 });
  });
});
