import type { ConnectionProfile, Provider } from "../types";
import { QdrantAdapter } from "./qdrant";
import type { VectorDBAdapter } from "./types";

export type AdapterFactory = () => VectorDBAdapter;
export type AdapterFactories = Partial<Record<Provider, AdapterFactory>>;

const defaultFactories: Record<Provider, AdapterFactory> = {
  qdrant: () => new QdrantAdapter(),
};

export async function createAdapter(
  connection: ConnectionProfile,
  factories: AdapterFactories = defaultFactories,
): Promise<VectorDBAdapter> {
  const factory = factories[connection.provider];

  if (!factory) {
    throw new Error(`Unknown provider: ${connection.provider}`);
  }

  const adapter = factory();
  await adapter.connect(connection);
  return adapter;
}
