import type { ConnectionProfile, ConnectionStatus } from "../types";

const CHECK_TIMEOUT_MS = 3000;

export async function checkConnectionReachable(
  connection: ConnectionProfile,
  fetchImpl: typeof fetch = fetch,
): Promise<ConnectionStatus> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

    const headers: Record<string, string> = {};
    if (connection.apiKey) {
      headers["api-key"] = connection.apiKey;
    }

    const response = await fetchImpl(connection.url, { signal: controller.signal, headers });
    clearTimeout(timeout);

    return response.ok ? "reachable" : "unreachable";
  } catch {
    return "unreachable";
  }
}
