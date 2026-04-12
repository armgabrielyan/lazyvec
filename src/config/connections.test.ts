import { describe, expect, test } from "bun:test";
import { buildConnectionState, parseCliConnection, parseConfigText } from "./connections";

describe("connection config", () => {
  test("missing config returns an onboarding state without assuming local Qdrant", () => {
    const state = buildConnectionState({
      configText: null,
      argv: [],
    });

    expect(state.connections).toEqual([]);
    expect(state.onboarding.missingConfig).toBe(true);
    expect(state.onboarding.configPath).toBe("~/.lazyvec/config.toml");
  });

  test("parses configured Qdrant connections", () => {
    const state = buildConnectionState({
      configText: `
        default = "local-qdrant"

        [connections.local-qdrant]
        provider = "qdrant"
        url = "http://localhost:6333"

        [connections.dev-qdrant]
        provider = "qdrant"
        url = "http://127.0.0.1:6333"
      `,
      argv: [],
    });

    expect(state.connections).toEqual([
      {
        id: "local-qdrant",
        name: "local-qdrant",
        provider: "qdrant",
        url: "http://localhost:6333",
        description: "Configured in ~/.lazyvec/config.toml",
        source: "config",
      },
      {
        id: "dev-qdrant",
        name: "dev-qdrant",
        provider: "qdrant",
        url: "http://127.0.0.1:6333",
        description: "Configured in ~/.lazyvec/config.toml",
        source: "config",
      },
    ]);
    expect(state.defaultConnectionId).toBe("local-qdrant");
    expect(state.onboarding.missingConfig).toBe(false);
  });

  test("empty config returns no connections without creating a fallback", () => {
    const state = buildConnectionState({
      configText: "",
      argv: [],
    });

    expect(state.connections).toEqual([]);
    expect(state.onboarding.missingConfig).toBe(false);
  });

  test("rejects unsupported providers", () => {
    expect(() =>
      parseConfigText(`
        [connections.prod-pinecone]
        provider = "pinecone"
        api_key_env = "PINECONE_API_KEY"
      `),
    ).toThrow('Connection "prod-pinecone" uses unsupported provider "pinecone"');
  });

  test("requires a url for Qdrant connections", () => {
    expect(() =>
      parseConfigText(`
        [connections.local-qdrant]
        provider = "qdrant"
      `),
    ).toThrow('Connection "local-qdrant" must include a url');
  });

  test("parses explicit quick-connect args", () => {
    expect(parseCliConnection(["--provider", "qdrant", "--url", "http://localhost:6333"])).toEqual({
      id: "cli-qdrant",
      name: "cli-qdrant",
      provider: "qdrant",
      url: "http://localhost:6333",
      description: "Provided by CLI flags",
      source: "cli",
    });
  });

  test("quick-connect is prepended without creating a fallback connection", () => {
    const state = buildConnectionState({
      configText: null,
      argv: ["--provider", "qdrant", "--url", "http://localhost:6333"],
    });

    expect(state.connections.map((connection) => connection.id)).toEqual(["cli-qdrant"]);
    expect(state.onboarding.missingConfig).toBe(true);
  });
});
