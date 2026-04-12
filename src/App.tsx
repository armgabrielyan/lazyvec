import { useKeyboard, useRenderer } from "@opentui/react";
import { useMemo, useReducer } from "react";
import type { ReactNode } from "react";
import { ConnectionSelect } from "./components/ConnectionSelect";
import { clamp, formatCount, formatMetadataValue, formatVectorPreview, metadataPreview, pad, truncate } from "./format";
import { mockCollections } from "./mock-data";
import type { CollectionDataset, ConnectionProfile, ConnectionState, Panel, Screen, VectorRecord } from "./types";

const panelOrder: Panel[] = ["collections", "records", "inspector"];

const colors = {
  accent: "#7dd3fc",
  border: "#3f4655",
  danger: "#f87171",
  focus: "#a7f3d0",
  muted: "#8b95a7",
  selectedBg: "#263141",
  text: "#e5e7eb",
  title: "#f8fafc",
};

type TuiDimension = number | "auto" | `${number}%`;

interface AppState {
  screen: Screen;
  selectedConnectionIndex: number;
  selectedCollectionIndex: number;
  selectedRecordIndex: number;
  focusedPanel: Panel;
  showHelp: boolean;
  status: string;
}

type AppAction =
  | { type: "MOVE_CONNECTION"; delta: number; connectionCount: number }
  | { type: "CONNECT_SELECTED"; connectionName: string | null }
  | { type: "BACK_TO_CONNECTIONS" }
  | { type: "CYCLE_FOCUS"; delta: number }
  | { type: "MOVE_IN_FOCUSED_PANEL"; delta: number; collectionCount: number; recordCount: number }
  | { type: "SELECT_CURRENT"; recordCount: number }
  | { type: "REFRESH" }
  | { type: "TOGGLE_HELP" };

function createInitialState(connectionCount: number): AppState {
  return {
    screen: "connections",
    selectedConnectionIndex: 0,
    selectedCollectionIndex: 0,
    selectedRecordIndex: 0,
    focusedPanel: "collections",
    showHelp: false,
    status: connectionCount === 0 ? "Add a connection before connecting." : "Select a connection to start.",
  };
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "MOVE_CONNECTION": {
      if (action.connectionCount === 0) {
        return {
          ...state,
          selectedConnectionIndex: 0,
          status: "Add a connection before connecting.",
        };
      }

      const selectedConnectionIndex = clamp(
        state.selectedConnectionIndex + action.delta,
        0,
        action.connectionCount - 1,
      );

      return {
        ...state,
        selectedConnectionIndex,
        status: "Connection selected.",
      };
    }

    case "CONNECT_SELECTED": {
      if (action.connectionName === null) {
        return {
          ...state,
          status: "Add a connection before connecting.",
        };
      }

      return {
        ...state,
        screen: "main",
        focusedPanel: "collections",
        selectedCollectionIndex: 0,
        selectedRecordIndex: 0,
        status: `Connected to ${action.connectionName}.`,
      };
    }

    case "BACK_TO_CONNECTIONS":
      return {
        ...state,
        screen: "connections",
        focusedPanel: "collections",
        status: "Choose a connection.",
      };

    case "CYCLE_FOCUS": {
      const currentIndex = panelOrder.indexOf(state.focusedPanel);
      const nextIndex = (currentIndex + action.delta + panelOrder.length) % panelOrder.length;
      const focusedPanel = panelOrder[nextIndex] ?? "collections";

      return {
        ...state,
        focusedPanel,
        status: `Focused ${focusedPanel}.`,
      };
    }

    case "MOVE_IN_FOCUSED_PANEL": {
      if (state.focusedPanel === "collections") {
        const selectedCollectionIndex = clamp(
          state.selectedCollectionIndex + action.delta,
          0,
          action.collectionCount - 1,
        );
        const collection = mockCollections[selectedCollectionIndex] ?? mockCollections[0]!;

        return {
          ...state,
          selectedCollectionIndex,
          selectedRecordIndex: 0,
          status: `Selected collection ${collection.name}.`,
        };
      }

      if (state.focusedPanel === "records") {
        const selectedRecordIndex = clamp(state.selectedRecordIndex + action.delta, 0, action.recordCount - 1);

        return {
          ...state,
          selectedRecordIndex,
          status: "Selected record updated.",
        };
      }

      return state;
    }

    case "SELECT_CURRENT": {
      if (state.focusedPanel === "collections") {
        const collection = mockCollections[state.selectedCollectionIndex] ?? mockCollections[0]!;

        return {
          ...state,
          selectedRecordIndex: 0,
          focusedPanel: "records",
          status: `Browsing records in ${collection.name}.`,
        };
      }

      if (state.focusedPanel === "records" && action.recordCount > 0) {
        return {
          ...state,
          focusedPanel: "inspector",
          status: "Inspector focused for selected record.",
        };
      }

      return state;
    }

    case "REFRESH":
      return {
        ...state,
        status: "Mock data refreshed.",
      };

    case "TOGGLE_HELP":
      return {
        ...state,
        showHelp: !state.showHelp,
      };
  }
}

interface AppProps {
  connectionState: ConnectionState;
}

export function App({ connectionState }: AppProps) {
  const renderer = useRenderer();
  const connections = connectionState.connections;
  const [state, dispatch] = useReducer(appReducer, connections.length, createInitialState);

  const selectedConnection = connections[state.selectedConnectionIndex] ?? null;
  const selectedCollection = mockCollections[state.selectedCollectionIndex] ?? mockCollections[0]!;
  const records = selectedCollection.records;
  const selectedRecord = records[state.selectedRecordIndex] ?? null;

  useKeyboard((key) => {
    if (key.eventType === "release") {
      return;
    }

    if ((key.ctrl && key.name === "c") || key.name === "q") {
      renderer.destroy();
      return;
    }

    if (key.name === "?" || (key.shift && key.name === "/")) {
      dispatch({ type: "TOGGLE_HELP" });
      return;
    }

    if (state.screen === "connections") {
      if (key.name === "down" || key.name === "j") {
        dispatch({ type: "MOVE_CONNECTION", delta: 1, connectionCount: connections.length });
        return;
      }

      if (key.name === "up" || key.name === "k") {
        dispatch({ type: "MOVE_CONNECTION", delta: -1, connectionCount: connections.length });
        return;
      }

      if (key.name === "enter" || key.name === "return") {
        dispatch({ type: "CONNECT_SELECTED", connectionName: selectedConnection?.name ?? null });
      }

      return;
    }

    if (key.name === "tab") {
      dispatch({ type: "CYCLE_FOCUS", delta: key.shift ? -1 : 1 });
      return;
    }

    if (key.name === "c") {
      dispatch({ type: "BACK_TO_CONNECTIONS" });
      return;
    }

    if (key.name === "r") {
      dispatch({ type: "REFRESH" });
      return;
    }

    if (key.name === "enter" || key.name === "return") {
      dispatch({ type: "SELECT_CURRENT", recordCount: records.length });
      return;
    }

    if (key.name === "down" || key.name === "j") {
      dispatch({
        type: "MOVE_IN_FOCUSED_PANEL",
        delta: 1,
        collectionCount: mockCollections.length,
        recordCount: records.length,
      });
      return;
    }

    if (key.name === "up" || key.name === "k") {
      dispatch({
        type: "MOVE_IN_FOCUSED_PANEL",
        delta: -1,
        collectionCount: mockCollections.length,
        recordCount: records.length,
      });
    }
  });

  return (
    <box flexDirection="column" width="100%" height="100%">
      <Header connection={selectedConnection} collection={selectedCollection} screen={state.screen} />

      {state.screen === "connections" ? (
        <ConnectionSelect
          configPath={connectionState.onboarding.configPath}
          connections={connections}
          selectedIndex={state.selectedConnectionIndex}
        />
      ) : (
        <MainView
          collections={mockCollections}
          focusedPanel={state.focusedPanel}
          records={records}
          selectedCollectionIndex={state.selectedCollectionIndex}
          selectedRecord={selectedRecord}
          selectedRecordIndex={state.selectedRecordIndex}
        />
      )}

      {state.showHelp ? <HelpOverlay screen={state.screen} /> : null}
      <StatusBar focusedPanel={state.focusedPanel} screen={state.screen} status={state.status} />
    </box>
  );
}

interface HeaderProps {
  connection: ConnectionProfile | null;
  collection: CollectionDataset;
  screen: Screen;
}

function Header({ connection, collection, screen }: HeaderProps) {
  const location = screen === "connections" ? "choose connection" : collection.name;
  const endpoint = connection === null ? "no connection" : `${connection.provider}://${connection.url.replace(/^https?:\/\//, "")}`;

  return (
    <box border borderColor={colors.border} height={3} paddingX={1} alignItems="center">
      <text fg={colors.title}>{`lazyvec  ${endpoint}  ${location}`}</text>
    </box>
  );
}

interface MainViewProps {
  collections: CollectionDataset[];
  focusedPanel: Panel;
  records: VectorRecord[];
  selectedCollectionIndex: number;
  selectedRecord: VectorRecord | null;
  selectedRecordIndex: number;
}

function MainView({
  collections,
  focusedPanel,
  records,
  selectedCollectionIndex,
  selectedRecord,
  selectedRecordIndex,
}: MainViewProps) {
  return (
    <box flexGrow={1} flexDirection="row">
      <CollectionPanel
        collections={collections}
        focused={focusedPanel === "collections"}
        selectedIndex={selectedCollectionIndex}
      />
      <box flexGrow={1} flexDirection="column">
        <RecordTable focused={focusedPanel === "records"} records={records} selectedIndex={selectedRecordIndex} />
        <Inspector focused={focusedPanel === "inspector"} record={selectedRecord} />
      </box>
    </box>
  );
}

interface PanelFrameProps {
  children: ReactNode;
  focused: boolean;
  height?: TuiDimension;
  title: string;
  width?: TuiDimension;
  flexGrow?: number;
}

function PanelFrame({ children, focused, height, title, width, flexGrow }: PanelFrameProps) {
  return (
    <box
      border
      borderColor={focused ? colors.focus : colors.border}
      flexDirection="column"
      flexGrow={flexGrow}
      height={height}
      paddingX={1}
      title={focused ? `${title} *` : title}
      width={width}
    >
      {children}
    </box>
  );
}

interface CollectionPanelProps {
  collections: CollectionDataset[];
  focused: boolean;
  selectedIndex: number;
}

function CollectionPanel({ collections, focused, selectedIndex }: CollectionPanelProps) {
  return (
    <PanelFrame focused={focused} title="Collections" width={30}>
      <box flexDirection="column" flexGrow={1}>
        {collections.map((collection, index) => {
          const selected = index === selectedIndex;
          const line = `${selected ? "> " : "  "}${pad(collection.name, 12)} ${pad(formatCount(collection.count), 5)} ${collection.dimensions}d`;

          return (
            <text key={collection.name} fg={selected ? colors.text : colors.muted} bg={selected ? colors.selectedBg : undefined}>
              {line}
            </text>
          );
        })}
      </box>
    </PanelFrame>
  );
}

interface RecordTableProps {
  focused: boolean;
  records: VectorRecord[];
  selectedIndex: number;
}

function RecordTable({ focused, records, selectedIndex }: RecordTableProps) {
  const header = useMemo(() => `${pad("ID", 14)} ${pad("Dims", 5)} Metadata`, []);

  return (
    <PanelFrame focused={focused} flexGrow={1} title="Records">
      <text fg={colors.accent}>{header}</text>
      <box flexDirection="column" flexGrow={1}>
        {records.map((record, index) => {
          const selected = index === selectedIndex;
          const line = `${selected ? "> " : "  "}${pad(record.id, 12)} ${pad(`${record.dimensions}`, 5)} ${metadataPreview(record.metadata, 22)}`;

          return (
            <text key={record.id} fg={selected ? colors.text : colors.muted} bg={selected ? colors.selectedBg : undefined}>
              {line}
            </text>
          );
        })}
      </box>
    </PanelFrame>
  );
}

interface InspectorProps {
  focused: boolean;
  record: VectorRecord | null;
}

function Inspector({ focused, record }: InspectorProps) {
  if (record === null) {
    return (
      <PanelFrame focused={focused} height={13} title="Inspector">
        <text fg={colors.muted}>No record selected.</text>
      </PanelFrame>
    );
  }

  const metadataEntries = Object.entries(record.metadata);

  return (
    <PanelFrame focused={focused} height={13} title="Inspector">
      <text fg={colors.text}>ID: {record.id}</text>
      <text fg={colors.text}>Dims: {record.dimensions}</text>
      <text fg={colors.text}>Metadata:</text>
      {metadataEntries.slice(0, 5).map(([key, value]) => (
        <text key={key} fg={colors.muted}>{`  ${key}: ${truncate(formatMetadataValue(value), 32)}`}</text>
      ))}
      <text fg={colors.text}>Vector preview:</text>
      <text fg={colors.muted}>{`  [${truncate(formatVectorPreview(record.vector), 40)}, ...]`}</text>
    </PanelFrame>
  );
}

interface HelpOverlayProps {
  screen: Screen;
}

function HelpOverlay({ screen }: HelpOverlayProps) {
  const help =
    screen === "connections"
      ? "Connections: j/k move | Enter connect | ? help | q quit"
      : "Main: Tab focus | j/k move | Enter select/inspect | r refresh | c connections | ? help | q quit";

  return (
    <box border borderColor={colors.accent} paddingX={1} height={3} alignItems="center">
      <text fg={colors.text}>{help}</text>
    </box>
  );
}

interface StatusBarProps {
  focusedPanel: Panel;
  screen: Screen;
  status: string;
}

function StatusBar({ focusedPanel, screen, status }: StatusBarProps) {
  const mode = screen === "connections" ? "connections" : `main:${focusedPanel}`;

  return (
    <box border borderColor={colors.border} height={3} paddingX={1} alignItems="center">
      <text fg={colors.text}>{`${mode}  ${status}`}</text>
    </box>
  );
}
