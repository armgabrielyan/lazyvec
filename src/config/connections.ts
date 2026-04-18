import { parse } from "smol-toml";
import type { ConnectionProfile, ConnectionState, Provider } from "../types";
import { defaultConfigPath, displayConfigPath } from "./paths";

interface BuildConnectionStateOptions {
  argv: string[];
  configPath?: string;
  configText: string | null;
  displayPath?: string;
}

interface RawLazyvecConfig {
  default?: unknown;
  connections?: unknown;
}

const supportedProviders = new Set<Provider>(["qdrant", "pinecone"]);
const urlRequiredProviders = new Set<Provider>(["qdrant"]);

export function buildConnectionState({
  argv,
  configText,
  displayPath = displayConfigPath,
}: BuildConnectionStateOptions): ConnectionState {
  const configState = configText === null ? null : parseConfigText(configText, displayPath);
  const configConnections = configState?.connections ?? [];
  const defaultConnectionId = configState?.defaultConnectionId;
  const cliConnection = parseCliConnection(argv);
  const connections = cliConnection === null ? configConnections : [cliConnection, ...configConnections];

  return {
    connections,
    defaultConnectionId,
    onboarding: {
      configPath: displayPath,
      missingConfig: configText === null,
    },
  };
}

export async function loadConnectionState(argv: string[], configPath = defaultConfigPath()): Promise<ConnectionState> {
  const configFile = Bun.file(configPath);
  const configText = (await configFile.exists()) ? await configFile.text() : null;

  return buildConnectionState({
    argv,
    configPath,
    configText,
  });
}

export function parseConfigText(configText: string, displayPath = displayConfigPath): ConnectionState {
  const rawConfig = parse(configText) as RawLazyvecConfig;
  const rawConnections =
    rawConfig.connections === undefined ? {} : toRecord(rawConfig.connections, "connections must be a table");
  const connections = Object.entries(rawConnections).map(([name, rawConnection]) =>
    parseConfigConnection(name, toRecord(rawConnection, `Connection "${name}" must be a table`), displayPath),
  );
  const defaultConnectionId = rawConfig.default === undefined ? undefined : expectString(rawConfig.default, "default must be a string");

  return {
    connections,
    defaultConnectionId,
    onboarding: {
      configPath: displayPath,
      missingConfig: false,
    },
  };
}

export function parseCliConnection(argv: string[]): ConnectionProfile | null {
  const provider = readFlag(argv, "--provider", "-p");
  const url = readFlag(argv, "--url", "-u");
  const apiKey = readFlag(argv, "--api-key", "-k");

  if (provider === null && url === null && apiKey === null) {
    return null;
  }

  if (provider === null) {
    throw new Error("Quick connect requires --provider");
  }

  const normalizedProvider = parseProvider(provider, "CLI quick-connect");

  if (urlRequiredProviders.has(normalizedProvider) && url === null) {
    throw new Error(`Quick connect requires --url for provider "${normalizedProvider}"`);
  }

  if (normalizedProvider === "pinecone" && apiKey === null) {
    throw new Error('Quick connect requires --api-key for provider "pinecone"');
  }

  return {
    id: `cli-${normalizedProvider}`,
    name: `cli-${normalizedProvider}`,
    provider: normalizedProvider,
    ...(url === null ? {} : { url }),
    ...(apiKey === null ? {} : { apiKey }),
    description: "Provided by CLI flags",
    source: "cli",
  };
}

function parseConfigConnection(
  name: string,
  rawConnection: Record<string, unknown>,
  displayPath: string,
): ConnectionProfile {
  const provider = parseProvider(rawConnection.provider, `Connection "${name}"`);
  const url = parseOptionalUrl(provider, rawConnection.url, name);
  const apiKey = rawConnection.api_key === undefined
    ? undefined
    : expectString(rawConnection.api_key, `Connection "${name}" api_key must be a non-empty string`);

  if (provider === "pinecone" && apiKey === undefined) {
    throw new Error(`Connection "${name}" must include api_key for provider "pinecone"`);
  }

  return {
    id: name,
    name,
    provider,
    ...(url === undefined ? {} : { url }),
    ...(apiKey === undefined ? {} : { apiKey }),
    description: `Configured in ${displayPath}`,
    source: "config",
  };
}

function parseOptionalUrl(provider: Provider, raw: unknown, name: string): string | undefined {
  if (raw === undefined) {
    if (urlRequiredProviders.has(provider)) {
      throw new Error(`Connection "${name}" must include a url`);
    }
    return undefined;
  }
  return expectString(raw, `Connection "${name}" must include a url`);
}

function parseProvider(value: unknown, context: string): Provider {
  const provider = expectString(value, `${context} must include a provider`);

  if (!supportedProviders.has(provider as Provider)) {
    throw new Error(`${context} uses unsupported provider "${provider}"`);
  }

  return provider as Provider;
}

function expectString(value: unknown, message: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(message);
  }

  return value;
}

function toRecord(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(message);
  }

  return value as Record<string, unknown>;
}

function readFlag(argv: string[], longName: string, shortName: string): string | null {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === longName || arg === shortName) {
      return argv[index + 1] ?? null;
    }

    if (arg?.startsWith(`${longName}=`)) {
      return arg.slice(longName.length + 1);
    }
  }

  return null;
}
