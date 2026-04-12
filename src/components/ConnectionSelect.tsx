import { pad, truncate } from "../format";
import type { ConnectionProfile } from "../types";

const colors = {
  border: "#3f4655",
  muted: "#8b95a7",
  selectedBg: "#263141",
  text: "#e5e7eb",
};

interface ConnectionSelectProps {
  configPath: string;
  connections: ConnectionProfile[];
  selectedIndex: number;
}

export function ConnectionSelect({ configPath, connections, selectedIndex }: ConnectionSelectProps) {
  return (
    <box flexGrow={1} alignItems="center" justifyContent="center">
      <box
        border
        borderColor={colors.border}
        title="Connections"
        width="76%"
        maxWidth={92}
        minWidth={54}
        paddingX={2}
        paddingY={1}
        flexDirection="column"
        gap={1}
      >
        {connections.length === 0 ? (
          <NoConnections configPath={configPath} />
        ) : (
          <ConnectionList connections={connections} selectedIndex={selectedIndex} />
        )}
      </box>
    </box>
  );
}

function NoConnections({ configPath }: { configPath: string }) {
  return (
    <box flexDirection="column" gap={1}>
      <text fg={colors.text}>No connections configured.</text>
      <text fg={colors.muted}>Add a connection at {configPath}:</text>
      <text fg={colors.muted}>[connections.local-qdrant]</text>
      <text fg={colors.muted}>provider = "qdrant"</text>
      <text fg={colors.muted}>url = "http://localhost:6333"</text>
      <text fg={colors.muted}>q quits  |  ? help</text>
    </box>
  );
}

function ConnectionList({
  connections,
  selectedIndex,
}: {
  connections: ConnectionProfile[];
  selectedIndex: number;
}) {
  return (
    <box flexDirection="column" gap={1}>
      <text fg={colors.muted}>Pick a connection from ~/.lazyvec/config.toml or CLI flags.</text>
      {connections.map((connection, index) => {
        const selected = index === selectedIndex;
        const marker = selected ? "> " : "  ";
        const line = truncate(`${marker}${pad(connection.name, 18)} ${pad(connection.provider, 6)} ${connection.url}`, 56);

        return (
          <text key={connection.id} fg={selected ? colors.text : colors.muted} bg={selected ? colors.selectedBg : undefined}>
            {line}
          </text>
        );
      })}
      <text fg={colors.muted}>Enter connects  |  j/k moves  |  q quits</text>
    </box>
  );
}
