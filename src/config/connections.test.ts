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
        [connections.prod-weaviate]
        provider = "weaviate"
        url = "http://localhost:8080"
      `),
    ).toThrow('Connection "prod-weaviate" uses unsupported provider "weaviate"');
  });

  test("parses Pinecone connections without a url", () => {
    const state = parseConfigText(`
      [connections.cloud-pinecone]
      provider = "pinecone"
      api_key = "pcsk-secret"
    `);

    expect(state.connections).toEqual([
      {
        id: "cloud-pinecone",
        name: "cloud-pinecone",
        provider: "pinecone",
        apiKey: "pcsk-secret",
        description: "Configured in ~/.lazyvec/config.toml",
        source: "config",
      },
    ]);
  });

  test("Pinecone connections require an api_key", () => {
    expect(() =>
      parseConfigText(`
        [connections.cloud-pinecone]
        provider = "pinecone"
      `),
    ).toThrow('Connection "cloud-pinecone" must include api_key for provider "pinecone"');
  });

  test("parses api_key for Qdrant Cloud connections", () => {
    const state = parseConfigText(`
      [connections.cloud-qdrant]
      provider = "qdrant"
      url = "https://xyz.cloud.qdrant.io:6333"
      api_key = "secret-key-123"
    `);

    expect(state.connections).toEqual([
      {
        id: "cloud-qdrant",
        name: "cloud-qdrant",
        provider: "qdrant",
        url: "https://xyz.cloud.qdrant.io:6333",
        apiKey: "secret-key-123",
        description: "Configured in ~/.lazyvec/config.toml",
        source: "config",
      },
    ]);
  });

  test("connections without api_key do not include apiKey", () => {
    const state = parseConfigText(`
      [connections.local-qdrant]
      provider = "qdrant"
      url = "http://localhost:6333"
    `);

    expect(state.connections[0]).not.toHaveProperty("apiKey");
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

  test("interpolates ${VAR} references in api_key and preserves the literal", () => {
    const state = parseConfigText(
      `
        [connections.cloud-pinecone]
        provider = "pinecone"
        api_key = "\${PINECONE_API_KEY}"
      `,
      undefined,
      (name) => (name === "PINECONE_API_KEY" ? "pcsk-resolved" : undefined),
    );

    expect(state.connections[0]).toMatchObject({
      apiKey: "pcsk-resolved",
      apiKeyRaw: "${PINECONE_API_KEY}",
    });
  });

  test("interpolates ${VAR} references in url and preserves the literal", () => {
    const state = parseConfigText(
      `
        [connections.cloud-qdrant]
        provider = "qdrant"
        url = "\${QDRANT_URL}"
      `,
      undefined,
      (name) => (name === "QDRANT_URL" ? "https://cluster.qdrant.io:6333" : undefined),
    );

    expect(state.connections[0]).toMatchObject({
      url: "https://cluster.qdrant.io:6333",
      urlRaw: "${QDRANT_URL}",
    });
  });

  test("plaintext values do not emit *Raw fields", () => {
    const state = parseConfigText(`
      [connections.local-qdrant]
      provider = "qdrant"
      url = "http://localhost:6333"
      api_key = "plain-secret"
    `);

    expect(state.connections[0]).not.toHaveProperty("urlRaw");
    expect(state.connections[0]).not.toHaveProperty("apiKeyRaw");
  });

  test("missing env var referenced from api_key fails parse", () => {
    expect(() =>
      parseConfigText(
        `
          [connections.cloud-pinecone]
          provider = "pinecone"
          api_key = "\${MISSING_KEY}"
        `,
        undefined,
        () => undefined,
      ),
    ).toThrow(/MISSING_KEY/);
  });
});
