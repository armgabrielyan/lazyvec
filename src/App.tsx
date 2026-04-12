import { useKeyboard, useRenderer } from "@opentui/react";
import { useMemo, useReducer, useRef } from "react";
import type { ReactNode } from "react";
import { createAdapter as createDefaultAdapter } from "./adapters/registry";
import type { Collection, VectorDBAdapter, VectorPage, VectorRecord } from "./adapters/types";
import { loadCollectionRecords, loadInitialBrowserData, loadRecordDetails, type BrowserData } from "./app-data/browser-data";
import { ConnectionSelect } from "./components/ConnectionSelect";
import { clamp, formatCount, formatMetadataValue, formatVectorPreview, metadataPreview, pad, truncate } from "./format";
import type { ConnectionProfile, ConnectionState, Panel, Screen } from "./types";

const panelOrder: Panel[] = ["collections", "records", "inspector"];
const defaultPageSize = 50;

const colors = {
  accent: "#7dd3fc",
  border: "#3f4655",
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
  loading: boolean;
  error: string | null;
  collections: Collection[];
  records: VectorRecord[];
  inspectedRecord: VectorRecord | null;
  recordCursor?: string;
}

type AppAction =
  | { type: "MOVE_CONNECTION"; delta: number; connectionCount: number }
  | { type: "CONNECT_REQUEST"; connectionName: string | null }
  | { type: "CONNECT_SUCCESS"; connectionName: string; data: BrowserData }
  | { type: "CONNECT_FAILURE"; error: string }
  | { type: "BACK_TO_CONNECTIONS" }
  | { type: "CYCLE_FOCUS"; delta: number }
  | { type: "SELECT_COLLECTION_REQUEST"; index: number; collectionName: string }
  | { type: "SELECT_COLLECTION_SUCCESS"; index: number; collectionName: string; page: VectorPage }
  | { type: "MOVE_RECORD"; delta: number; recordCount: number }
  | { type: "INSPECT_RECORD_REQUEST"; recordId: string }
  | { type: "INSPECT_RECORD_SUCCESS"; record: VectorRecord }
  | { type: "LOAD_FAILURE"; error: string }
  | { type: "REFRESH_EMPTY" }
  | { type: "TOGGLE_HELP" };

interface AppProps {
  connectionState: ConnectionState;
  createAdapter?: typeof createDefaultAdapter;
  pageSize?: number;
}

function createInitialState(connectionCount: number): AppState {
  return {
    screen: "connections",
    selectedConnectionIndex: 0,
    selectedCollectionIndex: 0,
    selectedRecordIndex: 0,
    focusedPanel: "collections",
    showHelp: false,
    status: connectionCount === 0 ? "Add a connection before connecting." : "Select a connection to start.",
    loading: false,
    error: null,
    collections: [],
    records: [],
    inspectedRecord: null,
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

      return {
        ...state,
        selectedConnectionIndex: clamp(state.selectedConnectionIndex + action.delta, 0, action.connectionCount - 1),
        status: "Connection selected.",
      };
    }

    case "CONNECT_REQUEST":
      if (action.connectionName === null) {
        return {
          ...state,
          status: "Add a connection before connecting.",
        };
      }

      return {
        ...state,
        loading: true,
        error: null,
        status: `Connecting to ${action.connectionName}...`,
      };

    case "CONNECT_SUCCESS":
      return {
        ...state,
        screen: "main",
        focusedPanel: "collections",
        selectedCollectionIndex: 0,
        selectedRecordIndex: 0,
        loading: false,
        error: null,
        collections: action.data.collections,
        records: action.data.records,
        inspectedRecord: null,
        recordCursor: action.data.recordCursor,
        status:
          action.data.collections.length === 0
            ? `Connected to ${action.connectionName}. No collections found.`
            : `Connected to ${action.connectionName}. Loaded ${action.data.collections.length} collections.`,
      };

    case "CONNECT_FAILURE":
      return {
        ...state,
        loading: false,
        error: action.error,
        status: action.error,
      };

    case "BACK_TO_CONNECTIONS":
      return {
        ...state,
        screen: "connections",
        focusedPanel: "collections",
        collections: [],
        records: [],
        inspectedRecord: null,
        loading: false,
        error: null,
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

    case "SELECT_COLLECTION_REQUEST":
      return {
        ...state,
        selectedCollectionIndex: action.index,
        selectedRecordIndex: 0,
        records: [],
        inspectedRecord: null,
        loading: true,
        error: null,
        status: `Loading records from ${action.collectionName}...`,
      };

    case "SELECT_COLLECTION_SUCCESS":
      return {
        ...state,
        selectedCollectionIndex: action.index,
        selectedRecordIndex: 0,
        records: action.page.records,
        recordCursor: action.page.nextCursor,
        inspectedRecord: null,
        loading: false,
        error: null,
        status: `Loaded ${action.page.records.length} records from ${action.collectionName}.`,
      };

    case "MOVE_RECORD":
      if (action.recordCount === 0) {
        return {
          ...state,
          selectedRecordIndex: 0,
          inspectedRecord: null,
          status: "No records loaded.",
        };
      }

      return {
        ...state,
        selectedRecordIndex: clamp(state.selectedRecordIndex + action.delta, 0, action.recordCount - 1),
        inspectedRecord: null,
        status: "Selected record updated. Press Enter to inspect.",
      };

    case "INSPECT_RECORD_REQUEST":
      return {
        ...state,
        loading: true,
        error: null,
        status: `Loading ${action.recordId}...`,
      };

    case "INSPECT_RECORD_SUCCESS":
      return {
        ...state,
        focusedPanel: "inspector",
        inspectedRecord: action.record,
        loading: false,
        error: null,
        status: `Inspecting ${action.record.id}.`,
      };

    case "LOAD_FAILURE":
      return {
        ...state,
        loading: false,
        error: action.error,
        status: action.error,
      };

    case "REFRESH_EMPTY":
      return {
        ...state,
        status: "No collection selected.",
      };

    case "TOGGLE_HELP":
      return {
        ...state,
        showHelp: !state.showHelp,
      };
  }
}

export function App({
  connectionState,
  createAdapter = createDefaultAdapter,
  pageSize = defaultPageSize,
}: AppProps) {
  const renderer = useRenderer();
  const adapterRef = useRef<VectorDBAdapter | null>(null);
  const connections = connectionState.connections;
  const [state, dispatch] = useReducer(appReducer, connections.length, createInitialState);

  const selectedConnection = connections[state.selectedConnectionIndex] ?? null;
  const selectedCollection = state.collections[state.selectedCollectionIndex] ?? null;
  const selectedRecord = state.records[state.selectedRecordIndex] ?? null;

  async function disconnectCurrentAdapter() {
    await adapterRef.current?.disconnect();
    adapterRef.current = null;
  }

  function connectSelectedConnection() {
    dispatch({ type: "CONNECT_REQUEST", connectionName: selectedConnection?.name ?? null });

    if (selectedConnection === null) {
      return;
    }

    void (async () => {
      try {
        await disconnectCurrentAdapter();
        const adapter = await createAdapter(selectedConnection);
        adapterRef.current = adapter;
        const data = await loadInitialBrowserData(adapter, { pageSize });
        dispatch({ type: "CONNECT_SUCCESS", connectionName: selectedConnection.name, data });
      } catch (error) {
        await disconnectCurrentAdapter().catch(() => {
          adapterRef.current = null;
        });
        dispatch({ type: "CONNECT_FAILURE", error: toErrorMessage(error) });
      }
    })();
  }

  function selectCollectionByIndex(index: number) {
    const adapter = adapterRef.current;
    const collection = state.collections[index];

    if (adapter === null || collection === undefined) {
      dispatch({ type: "REFRESH_EMPTY" });
      return;
    }

    dispatch({ type: "SELECT_COLLECTION_REQUEST", index, collectionName: collection.name });
    void (async () => {
      try {
        const page = await loadCollectionRecords(adapter, collection.name, { pageSize });
        dispatch({ type: "SELECT_COLLECTION_SUCCESS", index, collectionName: collection.name, page });
      } catch (error) {
        dispatch({ type: "LOAD_FAILURE", error: toErrorMessage(error) });
      }
    })();
  }

  function moveCollection(delta: number) {
    if (state.collections.length === 0) {
      dispatch({ type: "REFRESH_EMPTY" });
      return;
    }

    const index = clamp(state.selectedCollectionIndex + delta, 0, state.collections.length - 1);
    selectCollectionByIndex(index);
  }

  function inspectSelectedRecord() {
    const adapter = adapterRef.current;

    if (adapter === null || selectedCollection === null || selectedRecord === null) {
      dispatch({ type: "LOAD_FAILURE", error: "No record selected." });
      return;
    }

    dispatch({ type: "INSPECT_RECORD_REQUEST", recordId: selectedRecord.id });
    void (async () => {
      try {
        const record = await loadRecordDetails(adapter, selectedCollection.name, selectedRecord.id);
        dispatch({ type: "INSPECT_RECORD_SUCCESS", record });
      } catch (error) {
        dispatch({ type: "LOAD_FAILURE", error: toErrorMessage(error) });
      }
    })();
  }

  function refreshCurrentCollection() {
    selectCollectionByIndex(state.selectedCollectionIndex);
  }

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

    if (state.loading) {
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
        connectSelectedConnection();
      }

      return;
    }

    if (key.name === "tab") {
      dispatch({ type: "CYCLE_FOCUS", delta: key.shift ? -1 : 1 });
      return;
    }

    if (key.name === "c") {
      void disconnectCurrentAdapter();
      dispatch({ type: "BACK_TO_CONNECTIONS" });
      return;
    }

    if (key.name === "r") {
      refreshCurrentCollection();
      return;
    }

    if (key.name === "enter" || key.name === "return") {
      if (state.focusedPanel === "collections") {
        dispatch({ type: "CYCLE_FOCUS", delta: 1 });
        return;
      }

      if (state.focusedPanel === "records") {
        inspectSelectedRecord();
      }

      return;
    }

    if (key.name === "down" || key.name === "j") {
      if (state.focusedPanel === "collections") {
        moveCollection(1);
      } else if (state.focusedPanel === "records") {
        dispatch({ type: "MOVE_RECORD", delta: 1, recordCount: state.records.length });
      }
      return;
    }

    if (key.name === "up" || key.name === "k") {
      if (state.focusedPanel === "collections") {
        moveCollection(-1);
      } else if (state.focusedPanel === "records") {
        dispatch({ type: "MOVE_RECORD", delta: -1, recordCount: state.records.length });
      }
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
          collectionDimensions={selectedCollection?.dimensions ?? 0}
          collections={state.collections}
          focusedPanel={state.focusedPanel}
          inspectedRecord={state.inspectedRecord}
          records={state.records}
          selectedCollectionIndex={state.selectedCollectionIndex}
          selectedRecordIndex={state.selectedRecordIndex}
        />
      )}

      {state.showHelp ? <HelpOverlay screen={state.screen} /> : null}
      <StatusBar focusedPanel={state.focusedPanel} loading={state.loading} screen={state.screen} status={state.status} />
    </box>
  );
}

interface HeaderProps {
  connection: ConnectionProfile | null;
  collection: Collection | null;
  screen: Screen;
}

function Header({ connection, collection, screen }: HeaderProps) {
  const location = screen === "connections" ? "choose connection" : collection?.name ?? "no collection";
  const endpoint = connection === null ? "no connection" : `${connection.provider}://${connection.url.replace(/^https?:\/\//, "")}`;

  return (
    <box border borderColor={colors.border} height={3} paddingX={1} alignItems="center">
      <text fg={colors.title}>{`lazyvec  ${endpoint}  ${location}`}</text>
    </box>
  );
}

interface MainViewProps {
  collectionDimensions: number;
  collections: Collection[];
  focusedPanel: Panel;
  inspectedRecord: VectorRecord | null;
  records: VectorRecord[];
  selectedCollectionIndex: number;
  selectedRecordIndex: number;
}

function MainView({
  collectionDimensions,
  collections,
  focusedPanel,
  inspectedRecord,
  records,
  selectedCollectionIndex,
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
        <RecordTable
          collectionDimensions={collectionDimensions}
          focused={focusedPanel === "records"}
          records={records}
          selectedIndex={selectedRecordIndex}
        />
        <Inspector collectionDimensions={collectionDimensions} focused={focusedPanel === "inspector"} record={inspectedRecord} />
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
  collections: Collection[];
  focused: boolean;
  selectedIndex: number;
}

function CollectionPanel({ collections, focused, selectedIndex }: CollectionPanelProps) {
  return (
    <PanelFrame focused={focused} title="Collections" width={30}>
      <box flexDirection="column" flexGrow={1}>
        {collections.length === 0 ? <text fg={colors.muted}>No collections.</text> : null}
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
  collectionDimensions: number;
  focused: boolean;
  records: VectorRecord[];
  selectedIndex: number;
}

function RecordTable({ collectionDimensions, focused, records, selectedIndex }: RecordTableProps) {
  const header = useMemo(() => `${pad("ID", 14)} ${pad("Dims", 5)} Metadata`, []);

  return (
    <PanelFrame focused={focused} flexGrow={1} title="Records">
      <text fg={colors.accent}>{header}</text>
      <box flexDirection="column" flexGrow={1}>
        {records.length === 0 ? <text fg={colors.muted}>No records loaded.</text> : null}
        {records.map((record, index) => {
          const selected = index === selectedIndex;
          const line = `${selected ? "> " : "  "}${pad(record.id, 12)} ${pad(`${collectionDimensions}`, 5)} ${metadataPreview(record.metadata, 22)}`;

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
  collectionDimensions: number;
  focused: boolean;
  record: VectorRecord | null;
}

function Inspector({ collectionDimensions, focused, record }: InspectorProps) {
  if (record === null) {
    return (
      <PanelFrame focused={focused} height={13} title="Inspector">
        <text fg={colors.muted}>Press Enter on a record to inspect it.</text>
      </PanelFrame>
    );
  }

  const metadataEntries = Object.entries(record.metadata);
  const vectorPreview = record.vector === null ? "not returned" : `[${truncate(formatVectorPreview(record.vector), 40)}, ...]`;

  return (
    <PanelFrame focused={focused} height={13} title="Inspector">
      <text fg={colors.text}>ID: {record.id}</text>
      <text fg={colors.text}>Dims: {collectionDimensions}</text>
      <text fg={colors.text}>Metadata:</text>
      {metadataEntries.slice(0, 5).map(([key, value]) => (
        <text key={key} fg={colors.muted}>{`  ${key}: ${truncate(formatMetadataValue(value), 32)}`}</text>
      ))}
      <text fg={colors.text}>Vector preview:</text>
      <text fg={colors.muted}>{`  ${vectorPreview}`}</text>
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
      : "Main: Tab focus | j/k move | Enter inspect | r refresh | c connections | ? help | q quit";

  return (
    <box border borderColor={colors.accent} paddingX={1} height={3} alignItems="center">
      <text fg={colors.text}>{help}</text>
    </box>
  );
}

interface StatusBarProps {
  focusedPanel: Panel;
  loading: boolean;
  screen: Screen;
  status: string;
}

function StatusBar({ focusedPanel, loading, screen, status }: StatusBarProps) {
  const mode = screen === "connections" ? "connections" : `main:${focusedPanel}`;
  const state = loading ? "loading" : "ready";

  return (
    <box border borderColor={colors.border} height={3} paddingX={1} alignItems="center">
      <text fg={colors.text}>{`${mode}  ${state}  ${status}`}</text>
    </box>
  );
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
