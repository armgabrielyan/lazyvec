import { describe, expect, test } from "bun:test";
import { interpolateEnvVars } from "./interpolate";

function makeEnv(entries: Record<string, string | undefined>) {
  return (name: string) => entries[name];
}

describe("interpolateEnvVars", () => {
  test("returns the input untouched when there is no ${VAR} pattern", () => {
    const result = interpolateEnvVars("plain-value", makeEnv({}), "context");
    expect(result).toEqual({ value: "plain-value", interpolated: false });
  });

  test("resolves a single env reference", () => {
    const result = interpolateEnvVars("${PINECONE_KEY}", makeEnv({ PINECONE_KEY: "pcsk-123" }), "ctx");
    expect(result).toEqual({ value: "pcsk-123", interpolated: true });
  });

  test("supports mixed content with multiple references", () => {
    const result = interpolateEnvVars(
      "${HOST}/v2?key=${TOKEN}",
      makeEnv({ HOST: "https://api", TOKEN: "abc" }),
      "ctx",
    );
    expect(result).toEqual({ value: "https://api/v2?key=abc", interpolated: true });
  });

  test("throws when the referenced env var is missing", () => {
    expect(() =>
      interpolateEnvVars("${MISSING}", makeEnv({}), 'Connection "prod"'),
    ).toThrow('Connection "prod" references environment variable "MISSING" which is not set');
  });

  test("throws when the referenced env var is empty string", () => {
    expect(() =>
      interpolateEnvVars("${EMPTY}", makeEnv({ EMPTY: "" }), 'Connection "prod"'),
    ).toThrow('Connection "prod" references environment variable "EMPTY" which is not set');
  });

  test("rejects malformed identifiers", () => {
    expect(() => interpolateEnvVars("${1BAD}", makeEnv({}), "ctx")).toThrow(/malformed/);
    expect(() => interpolateEnvVars("${}", makeEnv({}), "ctx")).toThrow(/malformed/);
    expect(() => interpolateEnvVars("${with space}", makeEnv({}), "ctx")).toThrow(/malformed/);
  });

  test("leaves literal $ and unbraced $VAR untouched", () => {
    const result = interpolateEnvVars("$FOO costs $5", makeEnv({ FOO: "x" }), "ctx");
    expect(result).toEqual({ value: "$FOO costs $5", interpolated: false });
  });
});
