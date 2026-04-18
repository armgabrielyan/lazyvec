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

  test("parses Chroma Cloud connections with tenant and database", () => {
    const state = parseConfigText(`
      [connections.chroma-cloud]
      provider = "chroma"
      api_key = "ck-secret"
      tenant = "tenant-uuid"
      database = "prod-db"
    `);

    expect(state.connections).toEqual([
      {
        id: "chroma-cloud",
        name: "chroma-cloud",
        provider: "chroma",
        apiKey: "ck-secret",
        tenant: "tenant-uuid",
        database: "prod-db",
        description: "Configured in ~/.lazyvec/config.toml",
        source: "config",
      },
    ]);
  });

  test("parses local Chroma connections with just a url", () => {
    const state = parseConfigText(`
      [connections.local-chroma]
      provider = "chroma"
      url = "http://localhost:8000"
    `);

    expect(state.connections[0]).toEqual({
      id: "local-chroma",
      name: "local-chroma",
      provider: "chroma",
      url: "http://localhost:8000",
      description: "Configured in ~/.lazyvec/config.toml",
      source: "config",
    });
  });

  test("Chroma requires url or api_key", () => {
    expect(() =>
      parseConfigText(`
        [connections.bare-chroma]
        provider = "chroma"
      `),
    ).toThrow('Connection "bare-chroma" must include a url or api_key for provider "chroma"');
  });

  test("tenant/database on non-chroma providers is rejected", () => {
    expect(() =>
      parseConfigText(`
        [connections.local-qdrant]
        provider = "qdrant"
        url = "http://localhost:6333"
        tenant = "nope"
      `),
    ).toThrow(/tenant\/database are only valid for provider "chroma"/);
  });

  test("interpolates ${VAR} in tenant and database", () => {
    const state = parseConfigText(
      `
        [connections.chroma-cloud]
        provider = "chroma"
        api_key = "ck-x"
        tenant = "\${CHROMA_TENANT}"
        database = "\${CHROMA_DATABASE}"
      `,
      undefined,
      (name) =>
        name === "CHROMA_TENANT"
          ? "tenant-uuid"
          : name === "CHROMA_DATABASE"
            ? "prod-db"
            : undefined,
    );

    expect(state.connections[0]).toMatchObject({
      tenant: "tenant-uuid",
      database: "prod-db",
      tenantRaw: "${CHROMA_TENANT}",
      databaseRaw: "${CHROMA_DATABASE}",
    });
  });

  test("quick-connect accepts chroma with api_key only", () => {
    expect(
      parseCliConnection(["--provider", "chroma", "--api-key", "ck-secret", "--tenant", "t1"]),
    ).toEqual({
      id: "cli-chroma",
      name: "cli-chroma",
      provider: "chroma",
      apiKey: "ck-secret",
      tenant: "t1",
      description: "Provided by CLI flags",
      source: "cli",
    });
  });

  test("quick-connect chroma requires url or api_key", () => {
    expect(() => parseCliConnection(["--provider", "chroma"])).toThrow(
      /--url or --api-key for provider "chroma"/,
    );
  });

  test("quick-connect rejects --tenant on non-chroma providers", () => {
    expect(() =>
      parseCliConnection(["--provider", "qdrant", "--url", "http://localhost:6333", "--tenant", "x"]),
    ).toThrow(/--tenant and --database are only valid for provider "chroma"/);
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
