import { describe, expect, test } from "bun:test";
import { parseChromaConnection } from "./chroma-client";
import type { ConnectionProfile } from "../types";

const base: ConnectionProfile = {
  id: "c",
  name: "c",
  provider: "chroma",
  description: "t",
  source: "cli",
};

describe("parseChromaConnection", () => {
  test("local http URL → mode local with hostname/port/ssl=false", () => {
    const opts = parseChromaConnection({ ...base, url: "http://localhost:8000" });
    expect(opts).toEqual({
      mode: "local",
      host: "localhost",
      port: 8000,
      ssl: false,
      headers: {},
    });
  });

  test("local https URL defaults to 443", () => {
    const opts = parseChromaConnection({ ...base, url: "https://chroma.internal" });
    expect(opts).toMatchObject({ mode: "local", host: "chroma.internal", port: 443, ssl: true });
  });

  test("local API key translates to x-chroma-token header", () => {
    const opts = parseChromaConnection({
      ...base,
      url: "http://localhost:8000",
      apiKey: "secret",
    });
    expect(opts.mode).toBe("local");
    if (opts.mode === "local") {
      expect(opts.headers).toEqual({ "x-chroma-token": "secret" });
    }
  });

  test("no URL + api key → mode cloud with tenant/database passthrough", () => {
    const opts = parseChromaConnection({
      ...base,
      apiKey: "ck-xxx",
      tenant: "tenant-1",
      database: "db-prod",
    });
    expect(opts).toEqual({
      mode: "cloud",
      apiKey: "ck-xxx",
      tenant: "tenant-1",
      database: "db-prod",
    });
  });

  test("no URL and no api key is rejected", () => {
    expect(() => parseChromaConnection(base)).toThrow(/requires a url or api_key/);
  });

  test("invalid URL is rejected", () => {
    expect(() => parseChromaConnection({ ...base, url: "not a url" })).toThrow(/invalid url/);
  });

  test("tenant/database thread into local mode too", () => {
    const opts = parseChromaConnection({
      ...base,
      url: "http://localhost:8000",
      tenant: "t",
      database: "d",
    });
    expect(opts).toMatchObject({ mode: "local", tenant: "t", database: "d" });
  });
});
