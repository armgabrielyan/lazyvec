import { SyntaxStyle } from "@opentui/core";
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react";
import { useMemo, useReducer, useRef } from "react";
import type { ReactNode } from "react";
import { createAdapter as createDefaultAdapter } from "./adapters/registry";
import type { Collection, VectorDBAdapter, VectorPage, VectorRecord } from "./adapters/types";
import {
  loadCollectionRecords,
  loadInitialBrowserData,
  loadNextCollectionRecords,
  loadRecordDetails,
  type BrowserData,
} from "./app-data/browser-data";
import { ConnectionSelect } from "./components/ConnectionSelect";
import { clamp } from "./format";
import { defaultCollectionPanelWidth, formatCollectionPanelRow, resizeCollectionPanelWidth } from "./layout/collection-panel";
import {
  formatInspectorVectorPreview,
  inspectorRecordForSelection,
} from "./layout/inspector";
import { formatRecordTableHeader, formatRecordTableRow, recordTableVisibleRowCount, visibleRecordWindow } from "./layout/record-table";
import {
  collectionPanelEmptyMessage,
  formatStatusBarText,
  headerParts,
  recordTableEmptyMessage,
  shouldShowStatusBar,
  statusTone,
} from "./layout/view-state";
import type { ConnectionProfile, ConnectionState, Panel, Screen } from "./types";

const panelOrder: Panel[] = ["collections", "records", "inspector"];
const defaultPageSize = 50;

const colors = {
  accent: "#7dd3fc",
  border: "#3f4655",
  error: "#fca5a5",
  focus: "#a7f3d0",
  headerBg: "#12312f",
  headerBorder: "#28d7a4",
  headerLabel: "#7dd3fc",
  headerMuted: "#9fb8ad",
  loading: "#facc15",
  muted: "#8b95a7",
  statusBg: "#10151f",
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
  collectionPanelWidth: number;
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
  | { type: "LOAD_NEXT_RECORDS_REQUEST"; collectionName: string }
  | { type: "LOAD_NEXT_RECORDS_SUCCESS"; page: VectorPage }
  | { type: "LOAD_NEXT_RECORDS_END" }
  | { type: "INSPECT_RECORD_REQUEST"; recordId: string }
  | { type: "INSPECT_RECORD_SUCCESS"; record: VectorRecord }
  | { type: "LOAD_FAILURE"; error: string }
  | { type: "REFRESH_EMPTY" }
  | { type: "RESIZE_COLLECTION_PANEL"; delta: number }
  | { type: "TOGGLE_HELP" };

interface AppProps {
  connectionState: ConnectionState;
  createAdapter?: typeof createDefaultAdapter;
  pageSize?: number;
}

export function createInitialState(connectionCount: number): AppState {
  return {
    screen: "connections",
    selectedConnectionIndex: 0,
    selectedCollectionIndex: 0,
    selectedRecordIndex: 0,
    focusedPanel: "collections",
    showHelp: false,
    status: "",
    loading: false,
    error: null,
    collections: [],
    records: [],
    inspectedRecord: null,
    collectionPanelWidth: defaultCollectionPanelWidth,
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "MOVE_CONNECTION": {
      if (action.connectionCount === 0) {
        return {
          ...state,
          selectedConnectionIndex: 0,
          status: "",
        };
      }

      return {
        ...state,
        selectedConnectionIndex: clamp(state.selectedConnectionIndex + action.delta, 0, action.connectionCount - 1),
        status: "",
      };
    }

    case "CONNECT_REQUEST":
      if (action.connectionName === null) {
        return {
          ...state,
          status: "",
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
        status: "",
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
        status: "",
      };

    case "CYCLE_FOCUS": {
      const currentIndex = panelOrder.indexOf(state.focusedPanel);
      const nextIndex = (currentIndex + action.delta + panelOrder.length) % panelOrder.length;
      const focusedPanel = panelOrder[nextIndex] ?? "collections";

      return {
        ...state,
        focusedPanel,
        error: null,
        status: "",
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
        status: "",
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
        status: "",
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
        status: "",
      };

    case "LOAD_NEXT_RECORDS_REQUEST":
      return {
        ...state,
        loading: true,
        error: null,
        status: "",
      };

    case "LOAD_NEXT_RECORDS_SUCCESS": {
      const records = [...state.records, ...action.page.records];
      const selectedRecordIndex = action.page.records.length === 0 ? state.selectedRecordIndex : state.records.length;

      return {
        ...state,
        focusedPanel: "records",
        selectedRecordIndex,
        records,
        recordCursor: action.page.nextCursor,
        inspectedRecord: null,
        loading: false,
        error: null,
        status: action.page.records.length === 0 || action.page.nextCursor === undefined ? "End of collection." : "",
      };
    }

    case "LOAD_NEXT_RECORDS_END":
      return {
        ...state,
        recordCursor: undefined,
        loading: false,
        status: "End of collection.",
      };

    case "INSPECT_RECORD_REQUEST":
      return {
        ...state,
        loading: true,
        error: null,
        status: "",
      };

    case "INSPECT_RECORD_SUCCESS":
      return {
        ...state,
        focusedPanel: "inspector",
        inspectedRecord: action.record,
        loading: false,
        error: null,
        status: "",
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

    case "RESIZE_COLLECTION_PANEL": {
      const collectionPanelWidth = resizeCollectionPanelWidth(state.collectionPanelWidth, action.delta);

      return {
        ...state,
        collectionPanelWidth,
        status: `Collection panel width: ${collectionPanelWidth}.`,
      };
    }

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
  const inspectorRecord = inspectorRecordForSelection(state.inspectedRecord, selectedRecord);

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

  function loadNextRecordPage() {
    const adapter = adapterRef.current;

    if (adapter === null || selectedCollection === null) {
      dispatch({ type: "REFRESH_EMPTY" });
      return;
    }

    if (state.recordCursor === undefined) {
      dispatch({ type: "LOAD_NEXT_RECORDS_END" });
      return;
    }

    const cursor = state.recordCursor;
    dispatch({ type: "LOAD_NEXT_RECORDS_REQUEST", collectionName: selectedCollection.name });
    void (async () => {
      try {
        const page = await loadNextCollectionRecords(adapter, selectedCollection.name, cursor, { pageSize });
        dispatch({ type: "LOAD_NEXT_RECORDS_SUCCESS", page });
      } catch (error) {
        dispatch({ type: "LOAD_FAILURE", error: toErrorMessage(error) });
      }
    })();
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

    if (key.name === "[" || key.sequence === "[") {
      dispatch({ type: "RESIZE_COLLECTION_PANEL", delta: -1 });
      return;
    }

    if (key.name === "]" || key.sequence === "]") {
      dispatch({ type: "RESIZE_COLLECTION_PANEL", delta: 1 });
      return;
    }

    if (key.name === "n" || key.name === "pagedown" || key.sequence === "\x1B[6~") {
      loadNextRecordPage();
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
      {state.screen === "main" ? <Header connection={selectedConnection} /> : null}

      {state.screen === "connections" ? (
        <ConnectionSelect
          configPath={connectionState.onboarding.configPath}
          connections={connections}
          selectedIndex={state.selectedConnectionIndex}
        />
      ) : (
        <MainView
          collectionDimensions={selectedCollection?.dimensions ?? 0}
          collectionPanelWidth={state.collectionPanelWidth}
          collections={state.collections}
          focusedPanel={state.focusedPanel}
          inspectedRecord={inspectorRecord}
          loading={state.loading}
          records={state.records}
          selectedCollectionIndex={state.selectedCollectionIndex}
          selectedRecordIndex={state.selectedRecordIndex}
        />
      )}

      {state.showHelp ? <HelpOverlay screen={state.screen} /> : null}
      {shouldShowStatusBar({ error: state.error, loading: state.loading, status: state.status }) ? (
        <StatusBar
          error={state.error}
          loading={state.loading}
          status={state.status}
        />
      ) : null}
    </box>
  );
}

interface HeaderProps {
  connection: ConnectionProfile | null;
}

function Header({ connection }: HeaderProps) {
  const header = headerParts({
    connectionName: connection?.name ?? "no connection",
  });

  return (
    <box
      border
      borderColor={colors.headerBorder}
      backgroundColor={colors.headerBg}
      flexDirection="row"
      height={3}
      paddingX={1}
      alignItems="center"
    >
      <HeaderField label={header.connectionLabel} value={header.connectionName} valueColor={colors.title} />
    </box>
  );
}

interface HeaderFieldProps {
  label: string;
  value: string | null;
  valueColor: string;
}

function HeaderField({ label, value, valueColor }: HeaderFieldProps) {
  return (
    <>
      <text fg={colors.headerLabel} bg={colors.headerBg}>{`${label} `}</text>
      <text fg={valueColor} bg={colors.headerBg}>{value}</text>
    </>
  );
}

interface MainViewProps {
  collectionDimensions: number;
  collectionPanelWidth: number;
  collections: Collection[];
  focusedPanel: Panel;
  inspectedRecord: VectorRecord | null;
  loading: boolean;
  records: VectorRecord[];
  selectedCollectionIndex: number;
  selectedRecordIndex: number;
}

function MainView({
  collectionDimensions,
  collectionPanelWidth,
  collections,
  focusedPanel,
  inspectedRecord,
  loading,
  records,
  selectedCollectionIndex,
  selectedRecordIndex,
}: MainViewProps) {
  const { width } = useTerminalDimensions();
  const recordPanelWidth = Math.max(40, width - collectionPanelWidth - 4);

  return (
    <box flexGrow={1} flexDirection="row">
      <CollectionPanel
        collections={collections}
        focused={focusedPanel === "collections"}
        loading={loading}
        width={collectionPanelWidth}
        selectedIndex={selectedCollectionIndex}
      />
      <box flexGrow={1} flexDirection="column">
        <RecordTable
          contentWidth={recordPanelWidth}
          focused={focusedPanel === "records"}
          loading={loading}
          records={records}
          selectedIndex={selectedRecordIndex}
        />
        <Inspector
          collectionDimensions={collectionDimensions}
          focused={focusedPanel === "inspector"}
          record={inspectedRecord}
        />
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
  loading: boolean;
  selectedIndex: number;
  width: number;
}

function CollectionPanel({ collections, focused, loading, selectedIndex, width }: CollectionPanelProps) {
  const emptyMessage = collectionPanelEmptyMessage({
    collectionCount: collections.length,
    loading,
  });

  return (
    <PanelFrame focused={focused} title="Collections" width={width}>
      <box flexDirection="column" flexGrow={1}>
        {emptyMessage === null ? null : <text fg={colors.muted}>{emptyMessage}</text>}
        {collections.map((collection, index) => {
          const selected = index === selectedIndex;
          const line = formatCollectionPanelRow(collection, selected, width);

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
  contentWidth: number;
  focused: boolean;
  loading: boolean;
  records: VectorRecord[];
  selectedIndex: number;
}

function RecordTable({ contentWidth, focused, loading, records, selectedIndex }: RecordTableProps) {
  const header = useMemo(() => formatRecordTableHeader(contentWidth), [contentWidth]);
  const { height } = useTerminalDimensions();
  const visibleRecords = visibleRecordWindow(records, selectedIndex, recordTableVisibleRowCount(height));
  const emptyMessage = recordTableEmptyMessage({
    loading,
    recordCount: records.length,
  });

  return (
    <PanelFrame focused={focused} flexGrow={1} title="Records">
      <text fg={colors.accent}>{header}</text>
      <box flexDirection="column" flexGrow={1}>
        {emptyMessage === null ? null : <text fg={colors.muted}>{emptyMessage}</text>}
        {visibleRecords.records.map((record, visibleIndex) => {
          const index = visibleRecords.startIndex + visibleIndex;
          const selected = index === selectedIndex;
          const line = formatRecordTableRow(record, selected, contentWidth);

          return (
            <text key={`${record.id}-${index}`} fg={selected ? colors.text : colors.muted} bg={selected ? colors.selectedBg : undefined}>
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
      <PanelFrame focused={focused} height="35%" title="Inspector">
        <text fg={colors.muted}>Select a record to inspect payload.</text>
      </PanelFrame>
    );
  }

  const payloadJson = JSON.stringify(record.metadata, null, 2);
  const syntaxStyle = useMemo(() => SyntaxStyle.create(), []);
  const vectorPreview = formatInspectorVectorPreview(record.vector);

  return (
    <PanelFrame focused={focused} height="35%" title="Inspector">
      <text fg={colors.text}>ID: {record.id}</text>
      <text fg={colors.text}>Dims: {collectionDimensions}</text>
      <text fg={colors.text}>Vector: {vectorPreview}</text>
      <text fg={colors.text}>Payload:</text>
      <scrollbox flexGrow={1}>
        <code content={payloadJson} filetype="json" syntaxStyle={syntaxStyle} />
      </scrollbox>
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
      : "Main: Tab | j/k | n next | Enter inspect | [/] width | r refresh | c conn | ? | q";

  return (
    <box border borderColor={colors.accent} paddingX={1} height={3} alignItems="center">
      <text fg={colors.text}>{help}</text>
    </box>
  );
}

interface StatusBarProps {
  error: string | null;
  loading: boolean;
  status: string;
}

function StatusBar({ error, loading, status }: StatusBarProps) {
  const tone = statusTone({ error, loading });
  const toneColor = tone === "error" ? colors.error : tone === "loading" ? colors.loading : colors.focus;

  return (
    <box
      border
      borderColor={toneColor}
      backgroundColor={colors.statusBg}
      flexDirection="row"
      height={3}
      paddingX={1}
      alignItems="center"
    >
      <text fg={toneColor} bg={colors.statusBg}>
        {formatStatusBarText({ status })}
      </text>
    </box>
  );
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
