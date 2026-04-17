import { afterEach, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "smol-toml";
import {
  addConnectionToConfig,
  deleteConnectionFromConfig,
  updateConnectionInConfig,
  validateConnectionName,
  validateConnectionUrl,
} from "./config-writer";

let tempDir: string;

async function setup(initialToml?: string): Promise<string> {
  tempDir = await mkdtemp(join(tmpdir(), "lazyvec-test-"));
  const configPath = join(tempDir, "config.toml");
  if (initialToml !== undefined) {
    await Bun.write(configPath, initialToml);
  }
  return configPath;
}

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
});

function readToml(configPath: string): Record<string, unknown> {
  const text = Bun.file(configPath);
  return parse(text.toString()) as Record<string, unknown>;
}

async function readTomlAsync(configPath: string): Promise<Record<string, unknown>> {
  const text = await Bun.file(configPath).text();
  return parse(text) as Record<string, unknown>;
}

describe("validateConnectionName", () => {
  test("accepts valid names", () => {
    expect(validateConnectionName("local-qdrant")).toBeNull();
    expect(validateConnectionName("my_db_1")).toBeNull();
    expect(validateConnectionName("Prod")).toBeNull();
  });

  test("rejects empty name", () => {
    expect(validateConnectionName("")).toBe("Name is required");
  });

  test("rejects names with special characters", () => {
    expect(validateConnectionName("my db")).not.toBeNull();
    expect(validateConnectionName("local.qdrant")).not.toBeNull();
  });
});

describe("validateConnectionUrl", () => {
  test("accepts valid URLs", () => {
    expect(validateConnectionUrl("http://localhost:6333")).toBeNull();
    expect(validateConnectionUrl("https://qdrant.example.com")).toBeNull();
  });

  test("rejects empty URL", () => {
    expect(validateConnectionUrl("")).toBe("URL is required");
  });

  test("rejects invalid URLs", () => {
    expect(validateConnectionUrl("not-a-url")).not.toBeNull();
  });
});

describe("addConnectionToConfig", () => {
  test("creates config file and directory when missing", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "lazyvec-test-"));
    const configPath = join(tempDir, "subdir", "config.toml");

    await addConnectionToConfig({ name: "local", provider: "qdrant", url: "http://localhost:6333" }, configPath);

    const config = await readTomlAsync(configPath);
    const connections = config.connections as Record<string, unknown>;
    expect(connections.local).toEqual({ provider: "qdrant", url: "http://localhost:6333" });
  });

  test("adds to an empty config", async () => {
    const configPath = await setup("");

    await addConnectionToConfig({ name: "local", provider: "qdrant", url: "http://localhost:6333" }, configPath);

    const config = await readTomlAsync(configPath);
    const connections = config.connections as Record<string, unknown>;
    expect(connections.local).toEqual({ provider: "qdrant", url: "http://localhost:6333" });
  });

  test("adds alongside existing connections", async () => {
    const configPath = await setup(`
[connections.existing]
provider = "qdrant"
url = "http://existing:6333"
`);

    await addConnectionToConfig({ name: "new-one", provider: "qdrant", url: "http://new:6333" }, configPath);

    const config = await readTomlAsync(configPath);
    const connections = config.connections as Record<string, Record<string, string>>;
    expect(connections.existing!.url).toBe("http://existing:6333");
    expect(connections["new-one"]!.url).toBe("http://new:6333");
  });

  test("persists api_key when provided", async () => {
    const configPath = await setup("");

    await addConnectionToConfig(
      { name: "cloud", provider: "qdrant", url: "https://xyz.cloud.qdrant.io:6333", apiKey: "sk-123" },
      configPath,
    );

    const config = await readTomlAsync(configPath);
    const connections = config.connections as Record<string, Record<string, string>>;
    expect(connections.cloud).toEqual({
      provider: "qdrant",
      url: "https://xyz.cloud.qdrant.io:6333",
      api_key: "sk-123",
    });
  });

  test("omits api_key when absent", async () => {
    const configPath = await setup("");

    await addConnectionToConfig({ name: "local", provider: "qdrant", url: "http://localhost:6333" }, configPath);

    const config = await readTomlAsync(configPath);
    const connections = config.connections as Record<string, Record<string, string>>;
    expect(connections.local).not.toHaveProperty("api_key");
  });

  test("rejects duplicate name", async () => {
    const configPath = await setup(`
[connections.local]
provider = "qdrant"
url = "http://localhost:6333"
`);

    await expect(
      addConnectionToConfig({ name: "local", provider: "qdrant", url: "http://other:6333" }, configPath),
    ).rejects.toThrow('Connection "local" already exists');
  });
});

describe("updateConnectionInConfig", () => {
  test("updates URL of existing connection", async () => {
    const configPath = await setup(`
[connections.local]
provider = "qdrant"
url = "http://localhost:6333"
`);

    await updateConnectionInConfig("local", { name: "local", provider: "qdrant", url: "http://localhost:6334" }, configPath);

    const config = await readTomlAsync(configPath);
    const connections = config.connections as Record<string, Record<string, string>>;
    expect(connections.local!.url).toBe("http://localhost:6334");
  });

  test("renames a connection", async () => {
    const configPath = await setup(`
[connections.old-name]
provider = "qdrant"
url = "http://localhost:6333"
`);

    await updateConnectionInConfig("old-name", { name: "new-name", provider: "qdrant", url: "http://localhost:6333" }, configPath);

    const config = await readTomlAsync(configPath);
    const connections = config.connections as Record<string, unknown>;
    expect(connections["old-name"]).toBeUndefined();
    expect(connections["new-name"]).toEqual({ provider: "qdrant", url: "http://localhost:6333" });
  });

  test("updates default when renaming the default connection", async () => {
    const configPath = await setup(`
default = "old-name"

[connections.old-name]
provider = "qdrant"
url = "http://localhost:6333"
`);

    await updateConnectionInConfig("old-name", { name: "new-name", provider: "qdrant", url: "http://localhost:6333" }, configPath);

    const config = await readTomlAsync(configPath);
    expect(config.default).toBe("new-name");
  });

  test("updates api_key when provided", async () => {
    const configPath = await setup(`
[connections.cloud]
provider = "qdrant"
url = "https://xyz.cloud.qdrant.io:6333"
api_key = "old-key"
`);

    await updateConnectionInConfig(
      "cloud",
      { name: "cloud", provider: "qdrant", url: "https://xyz.cloud.qdrant.io:6333", apiKey: "new-key" },
      configPath,
    );

    const config = await readTomlAsync(configPath);
    const connections = config.connections as Record<string, Record<string, string>>;
    expect(connections.cloud!.api_key).toBe("new-key");
  });

  test("removes api_key when cleared", async () => {
    const configPath = await setup(`
[connections.cloud]
provider = "qdrant"
url = "https://xyz.cloud.qdrant.io:6333"
api_key = "old-key"
`);

    await updateConnectionInConfig(
      "cloud",
      { name: "cloud", provider: "qdrant", url: "https://xyz.cloud.qdrant.io:6333" },
      configPath,
    );

    const config = await readTomlAsync(configPath);
    const connections = config.connections as Record<string, Record<string, string>>;
    expect(connections.cloud).not.toHaveProperty("api_key");
  });

  test("rejects renaming to an existing name", async () => {
    const configPath = await setup(`
[connections.first]
provider = "qdrant"
url = "http://first:6333"

[connections.second]
provider = "qdrant"
url = "http://second:6333"
`);

    await expect(
      updateConnectionInConfig("first", { name: "second", provider: "qdrant", url: "http://first:6333" }, configPath),
    ).rejects.toThrow('Connection "second" already exists');
  });

  test("rejects updating a non-existent connection", async () => {
    const configPath = await setup("");

    await expect(
      updateConnectionInConfig("missing", { name: "missing", provider: "qdrant", url: "http://x:6333" }, configPath),
    ).rejects.toThrow('Connection "missing" not found');
  });
});

describe("deleteConnectionFromConfig", () => {
  test("removes a connection", async () => {
    const configPath = await setup(`
[connections.local]
provider = "qdrant"
url = "http://localhost:6333"

[connections.other]
provider = "qdrant"
url = "http://other:6333"
`);

    await deleteConnectionFromConfig("local", configPath);

    const config = await readTomlAsync(configPath);
    const connections = config.connections as Record<string, unknown>;
    expect(connections.local).toBeUndefined();
    expect(connections.other).toBeDefined();
  });

  test("clears default when deleting the default connection", async () => {
    const configPath = await setup(`
default = "local"

[connections.local]
provider = "qdrant"
url = "http://localhost:6333"
`);

    await deleteConnectionFromConfig("local", configPath);

    const config = await readTomlAsync(configPath);
    expect(config.default).toBeUndefined();
  });

  test("rejects deleting a non-existent connection", async () => {
    const configPath = await setup("");

    await expect(deleteConnectionFromConfig("missing", configPath)).rejects.toThrow('Connection "missing" not found');
  });
});
