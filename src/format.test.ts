import { describe, expect, test } from "bun:test";
import { formatCount, metadataPreview, truncate } from "./format";

describe("format helpers", () => {
  test("formats compact counts", () => {
    expect(formatCount(999)).toBe("999");
    expect(formatCount(1_240)).toBe("1.2k");
    expect(formatCount(1_250_000)).toBe("1.3m");
  });

  test("truncates long strings", () => {
    expect(truncate("abcdef", 6)).toBe("abcdef");
    expect(truncate("abcdef", 5)).toBe("ab...");
  });

  test("creates bounded metadata previews", () => {
    expect(metadataPreview({ source: "wiki", title: "Quantum computing basics" }, 24)).toHaveLength(24);
  });
});
