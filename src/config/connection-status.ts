import type { ConnectionProfile, ConnectionStatus } from "../types";

const CHECK_TIMEOUT_MS = 3000;

export async function checkConnectionReachable(
  connection: ConnectionProfile,
  fetchImpl: typeof fetch = fetch,
): Promise<ConnectionStatus> {
  const target = reachabilityTarget(connection);
  if (target === null) {
    return "unknown";
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

    const response = await fetchImpl(target.url, { signal: controller.signal, headers: target.headers });
    clearTimeout(timeout);

    return response.ok ? "reachable" : "unreachable";
  } catch {
    return "unreachable";
  }
}

interface ReachabilityTarget {
  url: string;
  headers: Record<string, string>;
}

function reachabilityTarget(connection: ConnectionProfile): ReachabilityTarget | null {
  if (connection.provider === "pinecone") {
    if (!connection.apiKey) return null;
    return {
      url: "https://api.pinecone.io/indexes",
      headers: { "Api-Key": connection.apiKey, "X-Pinecone-API-Version": "2024-07" },
    };
  }

  if (connection.provider === "chroma") {
    if (connection.url) {
      const headers: Record<string, string> = {};
      if (connection.apiKey) {
        headers["x-chroma-token"] = connection.apiKey;
      }
      return { url: joinPath(connection.url, "/api/v2/heartbeat"), headers };
    }
    if (!connection.apiKey) return null;
    return {
      url: "https://api.trychroma.com/api/v2/heartbeat",
      headers: { "x-chroma-token": connection.apiKey },
    };
  }

  if (!connection.url) return null;

  const headers: Record<string, string> = {};
  if (connection.apiKey) {
    headers["api-key"] = connection.apiKey;
  }
  return { url: connection.url, headers };
}

function joinPath(base: string, path: string): string {
  const trimmed = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${trimmed}${path}`;
}
