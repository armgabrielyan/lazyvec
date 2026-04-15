import { pad } from "../format";
import { colors } from "../theme";
import type { ConnectionProfile, ConnectionStatus } from "../types";

const fixedColumns = {
  marker: 2,
  provider: 10,
  status: 10,
};

function nameColumnWidth(connections: ConnectionProfile[]): number {
  const longest = connections.reduce((max, c) => Math.max(max, c.name.length), 4);
  return longest + 2;
}

interface ConnectionSelectProps {
  configPath: string;
  connections: ConnectionProfile[];
  selectedIndex: number;
  statuses: Record<string, ConnectionStatus>;
}

export function ConnectionSelect({ configPath, connections, selectedIndex, statuses }: ConnectionSelectProps) {
  return (
    <box flexGrow={1} alignItems="center" justifyContent="center">
      <box
        border
        borderColor={colors.border}
        title="Connections"
        paddingX={2}
        paddingY={1}
        flexDirection="column"
        gap={1}
      >
        {connections.length === 0 ? (
          <NoConnections configPath={configPath} />
        ) : (
          <ConnectionList connections={connections} selectedIndex={selectedIndex} statuses={statuses} />
        )}
      </box>
    </box>
  );
}

function NoConnections({ configPath }: { configPath: string }) {
  return (
    <box flexDirection="column" gap={1}>
      <text fg={colors.text}>No connections configured.</text>
      <text fg={colors.muted}>Press 'a' to add a connection, or edit {configPath}:</text>
      <text fg={colors.muted}>[connections.local-qdrant]</text>
      <text fg={colors.muted}>provider = "qdrant"</text>
      <text fg={colors.muted}>url = "http://localhost:6333"</text>
    </box>
  );
}

function ConnectionList({
  connections,
  selectedIndex,
  statuses,
}: {
  connections: ConnectionProfile[];
  selectedIndex: number;
  statuses: Record<string, ConnectionStatus>;
}) {
  const nameWidth = nameColumnWidth(connections);
  const totalWidth = fixedColumns.marker + nameWidth + fixedColumns.provider + fixedColumns.status;
  const headerLine = `${" ".repeat(fixedColumns.marker)}${pad("Name", nameWidth)}${pad("Provider", fixedColumns.provider)}${"Status"}`;

  return (
    <box flexDirection="column">
      <text fg={colors.accent}>{headerLine}</text>
      <text fg={colors.border}>{"─".repeat(totalWidth)}</text>
      {connections.map((connection, index) => {
        const selected = index === selectedIndex;
        const status = statuses[connection.id] ?? "unknown";

        return (
          <ConnectionRow key={connection.id} connection={connection} nameWidth={nameWidth} selected={selected} status={status} />
        );
      })}
    </box>
  );
}

function statusLabel(status: ConnectionStatus): { text: string; color: string } {
  switch (status) {
    case "checking":
      return { text: "● checking", color: colors.muted };
    case "reachable":
      return { text: "● online", color: colors.reachable };
    case "unreachable":
      return { text: "● offline", color: colors.unreachable };
    case "unknown":
      return { text: "  —", color: colors.muted };
  }
}

function ConnectionRow({
  connection,
  nameWidth,
  selected,
  status,
}: {
  connection: ConnectionProfile;
  nameWidth: number;
  selected: boolean;
  status: ConnectionStatus;
}) {
  const marker = selected ? "> " : "  ";
  const { text: statusText, color: statusColor } = statusLabel(status);
  const line = `${marker}${pad(connection.name, nameWidth)}${pad(connection.provider, fixedColumns.provider)}`;

  return (
    <box flexDirection="row">
      <text fg={selected ? colors.text : colors.muted} bg={selected ? colors.selectedBg : undefined}>
        {line}
      </text>
      <text fg={statusColor} bg={selected ? colors.selectedBg : undefined}>
        {statusText}
      </text>
    </box>
  );
}
