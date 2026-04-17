import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { parse, stringify } from "smol-toml";
import type { Provider } from "../types";
import { defaultConfigPath } from "./paths";

export interface ConnectionInput {
  name: string;
  provider: Provider;
  url: string;
  apiKey?: string;
}

const CONNECTION_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function validateConnectionName(name: string): string | null {
  if (name.length === 0) return "Name is required";
  if (!CONNECTION_NAME_PATTERN.test(name)) return "Name may only contain letters, numbers, hyphens, and underscores";
  return null;
}

export function validateConnectionUrl(url: string): string | null {
  if (url.length === 0) return "URL is required";
  try {
    new URL(url);
    return null;
  } catch {
    return "URL must be a valid URL (e.g. http://localhost:6333)";
  }
}

interface RawConnection {
  provider: string;
  url: string;
  api_key?: string;
}

interface RawConfig {
  default?: string;
  connections?: Record<string, RawConnection>;
}

function toRawConnection(input: ConnectionInput): RawConnection {
  return {
    provider: input.provider,
    url: input.url,
    ...(input.apiKey ? { api_key: input.apiKey } : {}),
  };
}

async function readConfig(configPath: string): Promise<RawConfig> {
  const file = Bun.file(configPath);
  if (!(await file.exists())) return {};
  const text = await file.text();
  return text.trim().length === 0 ? {} : (parse(text) as unknown as RawConfig);
}

async function writeConfig(configPath: string, config: RawConfig): Promise<void> {
  await mkdir(dirname(configPath), { recursive: true });
  await Bun.write(configPath, stringify(config as Record<string, unknown>));
}

export async function addConnectionToConfig(
  input: ConnectionInput,
  configPath = defaultConfigPath(),
): Promise<void> {
  const config = await readConfig(configPath);
  config.connections ??= {};

  if (config.connections[input.name]) {
    throw new Error(`Connection "${input.name}" already exists`);
  }

  config.connections[input.name] = toRawConnection(input);
  await writeConfig(configPath, config);
}

export async function updateConnectionInConfig(
  oldName: string,
  input: ConnectionInput,
  configPath = defaultConfigPath(),
): Promise<void> {
  const config = await readConfig(configPath);
  config.connections ??= {};

  if (!config.connections[oldName]) {
    throw new Error(`Connection "${oldName}" not found`);
  }

  if (oldName !== input.name) {
    if (config.connections[input.name]) {
      throw new Error(`Connection "${input.name}" already exists`);
    }
    delete config.connections[oldName];
    if (config.default === oldName) {
      config.default = input.name;
    }
  }

  config.connections[input.name] = toRawConnection(input);
  await writeConfig(configPath, config);
}

export async function deleteConnectionFromConfig(
  name: string,
  configPath = defaultConfigPath(),
): Promise<void> {
  const config = await readConfig(configPath);
  config.connections ??= {};

  if (!config.connections[name]) {
    throw new Error(`Connection "${name}" not found`);
  }

  delete config.connections[name];

  if (config.default === name) {
    delete config.default;
  }

  await writeConfig(configPath, config);
}
