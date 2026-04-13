import type { ConnectionProfile, ConnectionStatus } from "../types";

const CHECK_TIMEOUT_MS = 3000;

export async function checkConnectionReachable(connection: ConnectionProfile): Promise<ConnectionStatus> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

    const response = await fetch(connection.url, { signal: controller.signal });
    clearTimeout(timeout);

    return response.ok ? "reachable" : "unreachable";
  } catch {
    return "unreachable";
  }
}
