import { describe, expect, test } from "bun:test";
import { clipboardCommand } from "./clipboard";

describe("clipboard", () => {
  test("returns pbcopy on macOS", () => {
    expect(clipboardCommand("darwin")).toEqual(["pbcopy"]);
  });

  test("returns xclip on Linux", () => {
    expect(clipboardCommand("linux")).toEqual(["xclip", "-selection", "clipboard"]);
  });

  test("returns clip on Windows", () => {
    expect(clipboardCommand("win32")).toEqual(["clip"]);
  });

  test("returns null for unsupported platforms", () => {
    expect(clipboardCommand("freebsd")).toBeNull();
  });
});
