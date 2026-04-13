import { SyntaxStyle } from "@opentui/core";
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react";
import { useEffect, useMemo, useReducer, useRef } from "react";
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
import { inferTableSchema, type TableSchema } from "./layout/metadata-schema";
import { formatRecordTableRow, formatTableHeader, recordTableVisibleRowCount, visibleRecordWindow } from "./layout/record-table";
import {
  collectionPanelEmptyMessage,
  formatStatusBarText,
  headerParts,
  recordTableEmptyMessage,
  shouldShowStatusBar,
  statusTone,
} from "./layout/view-state";
import { checkConnectionReachable } from "./config/connection-status";
import type { FilterCondition } from "./filter/parse";
import { formatFilterSummary, parseFilterInput } from "./filter/parse";
import type { ConnectionProfile, ConnectionState, ConnectionStatus, Panel, Screen } from "./types";

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
  connectionStatuses: Record<string, ConnectionStatus>;
  tableSchema: TableSchema;
  filterOpen: boolean;
  filterInput: string;
  filterCursor: number;
  activeFilter: FilterCondition[];
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
  | { type: "TOGGLE_HELP" }
  | { type: "CONNECTION_STATUS_UPDATE"; connectionId: string; status: ConnectionStatus }
  | { type: "OPEN_FILTER" }
  | { type: "CLOSE_FILTER" }
  | { type: "UPDATE_FILTER_INPUT"; value: string; cursor: number }
  | { type: "APPLY_FILTER"; conditions: FilterCondition[] }
  | { type: "APPLY_FILTER_SUCCESS"; page: VectorPage }
  | { type: "CLEAR_FILTER" };

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
    connectionStatuses: {},
    tableSchema: { columns: [] },
    filterOpen: false,
    filterInput: "",
    filterCursor: 0,
    activeFilter: [],
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
        tableSchema: inferTableSchema(action.data.records),
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
        tableSchema: { columns: [] },
        inspectedRecord: null,
        loading: false,
        error: null,
        status: "",
        filterOpen: false,
        filterInput: "",
        filterCursor: 0,
        activeFilter: [],
      };

    case "CYCLE_FOCUS": {
      const currentIndex = panelOrder.indexOf(state.focusedPanel);
      const nextIndex = (currentIndex + action.delta + panelOrder.length) % panelOrder.length;
      const focusedPanel = panelOrder[nextIndex] ?? "collections";

      return {
        ...state,
        focusedPanel,
        inspectedRecord: null,
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
        tableSchema: { columns: [] },
        inspectedRecord: null,
        loading: true,
        error: null,
        status: "",
        filterOpen: false,
        filterInput: "",
        filterCursor: 0,
        activeFilter: [],
      };

    case "SELECT_COLLECTION_SUCCESS":
      return {
        ...state,
        selectedCollectionIndex: action.index,
        selectedRecordIndex: 0,
        records: action.page.records,
        tableSchema: inferTableSchema(action.page.records),
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
        tableSchema: inferTableSchema(records),
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

    case "INSPECT_RECORD_SUCCESS": {
      const records = state.records.map((r) =>
        r.id === action.record.id ? { ...r, metadata: action.record.metadata } : r,
      );

      return {
        ...state,
        focusedPanel: "inspector",
        inspectedRecord: action.record,
        records,
        loading: false,
        error: null,
        status: "",
      };
    }

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

    case "CONNECTION_STATUS_UPDATE":
      return {
        ...state,
        connectionStatuses: {
          ...state.connectionStatuses,
          [action.connectionId]: action.status,
        },
      };

    case "OPEN_FILTER": {
      const prefill = state.activeFilter.length > 0 ? formatFilterSummary(state.activeFilter) : "";
      return {
        ...state,
        filterOpen: true,
        filterInput: prefill,
        filterCursor: prefill.length,
      };
    }

    case "CLOSE_FILTER":
      return {
        ...state,
        filterOpen: false,
        filterInput: "",
        filterCursor: 0,
      };

    case "UPDATE_FILTER_INPUT":
      return {
        ...state,
        filterInput: action.value,
        filterCursor: action.cursor,
      };

    case "APPLY_FILTER":
      return {
        ...state,
        activeFilter: action.conditions,
        selectedRecordIndex: 0,
        records: [],
        tableSchema: { columns: [] },
        inspectedRecord: null,
        loading: true,
        error: null,
        status: "",
      };

    case "APPLY_FILTER_SUCCESS":
      return {
        ...state,
        records: action.page.records,
        tableSchema: inferTableSchema(action.page.records),
        recordCursor: action.page.nextCursor,
        selectedRecordIndex: 0,
        loading: false,
        error: null,
        status: action.page.records.length === 0 ? "No records match filter." : "",
      };

    case "CLEAR_FILTER":
      return {
        ...state,
        filterOpen: false,
        filterInput: "",
        filterCursor: 0,
        activeFilter: [],
        selectedRecordIndex: 0,
        records: [],
        inspectedRecord: null,
        loading: true,
        error: null,
        status: "",
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

  useEffect(() => {
    if (state.screen !== "connections" || connections.length === 0) {
      return;
    }

    for (const connection of connections) {
      if (state.connectionStatuses[connection.id] !== undefined) {
        continue;
      }

      dispatch({ type: "CONNECTION_STATUS_UPDATE", connectionId: connection.id, status: "checking" });
      void checkConnectionReachable(connection).then((status) => {
        dispatch({ type: "CONNECTION_STATUS_UPDATE", connectionId: connection.id, status });
      });
    }
  }, [state.screen, connections, state.connectionStatuses]);

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
    const filter = state.activeFilter;
    dispatch({ type: "LOAD_NEXT_RECORDS_REQUEST", collectionName: selectedCollection.name });
    void (async () => {
      try {
        const page = await loadNextCollectionRecords(adapter, selectedCollection.name, cursor, { pageSize }, filter);
        dispatch({ type: "LOAD_NEXT_RECORDS_SUCCESS", page });
      } catch (error) {
        dispatch({ type: "LOAD_FAILURE", error: toErrorMessage(error) });
      }
    })();
  }

  function applyFilter() {
    const adapter = adapterRef.current;
    const conditions = parseFilterInput(state.filterInput);

    if (adapter === null || selectedCollection === null) {
      dispatch({ type: "CLOSE_FILTER" });
      return;
    }

    if (conditions.length === 0) {
      clearFilter();
      return;
    }

    dispatch({ type: "APPLY_FILTER", conditions });
    void (async () => {
      try {
        const page = await loadCollectionRecords(adapter, selectedCollection.name, { pageSize }, conditions);
        dispatch({ type: "APPLY_FILTER_SUCCESS", page });
      } catch (error) {
        dispatch({ type: "LOAD_FAILURE", error: toErrorMessage(error) });
      }
    })();
  }

  function clearFilter() {
    const adapter = adapterRef.current;

    if (adapter === null || selectedCollection === null) {
      dispatch({ type: "CLEAR_FILTER" });
      return;
    }

    dispatch({ type: "CLEAR_FILTER" });
    void (async () => {
      try {
        const page = await loadCollectionRecords(adapter, selectedCollection.name, { pageSize });
        dispatch({ type: "SELECT_COLLECTION_SUCCESS", index: state.selectedCollectionIndex, collectionName: selectedCollection.name, page });
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

    if (key.name === "escape") {
      if (state.showHelp) {
        dispatch({ type: "TOGGLE_HELP" });
      } else if (state.filterOpen) {
        dispatch({ type: "CLOSE_FILTER" });
      } else if (state.activeFilter.length > 0 && state.screen === "main") {
        clearFilter();
      } else if (state.screen === "main") {
        void disconnectCurrentAdapter();
        dispatch({ type: "BACK_TO_CONNECTIONS" });
      }
      return;
    }

    if (state.filterOpen) {
      const { filterInput: input, filterCursor: cursor } = state;

      if (key.name === "enter" || key.name === "return") {
        applyFilter();
      } else if (key.name === "left") {
        dispatch({ type: "UPDATE_FILTER_INPUT", value: input, cursor: Math.max(0, cursor - 1) });
      } else if (key.name === "right") {
        dispatch({ type: "UPDATE_FILTER_INPUT", value: input, cursor: Math.min(input.length, cursor + 1) });
      } else if (key.name === "backspace" || key.name === "delete") {
        if (cursor > 0) {
          const value = input.slice(0, cursor - 1) + input.slice(cursor);
          dispatch({ type: "UPDATE_FILTER_INPUT", value, cursor: cursor - 1 });
        }
      } else if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
        const value = input.slice(0, cursor) + key.sequence + input.slice(cursor);
        dispatch({ type: "UPDATE_FILTER_INPUT", value, cursor: cursor + 1 });
      }
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

    if (key.sequence === "/" && !key.shift) {
      dispatch({ type: "OPEN_FILTER" });
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
          statuses={state.connectionStatuses}
        />
      ) : (
        <MainView
          activeFilter={state.activeFilter}
          collectionDimensions={selectedCollection?.dimensions ?? 0}
          collectionPanelWidth={state.collectionPanelWidth}
          collections={state.collections}
          filterCursor={state.filterCursor}
          filterInput={state.filterInput}
          filterOpen={state.filterOpen}
          focusedPanel={state.focusedPanel}
          inspectedRecord={inspectorRecord}
          loading={state.loading}
          records={state.records}
          selectedCollectionIndex={state.selectedCollectionIndex}
          selectedRecordIndex={state.selectedRecordIndex}
          statusBarVisible={shouldShowStatusBar({ error: state.error, loading: state.loading, status: state.status })}
          tableSchema={state.tableSchema}
        />
      )}

      {state.showHelp ? (
        <box position="absolute" width="100%" height="100%" alignItems="center" justifyContent="center">
          <HelpOverlay screen={state.screen} />
        </box>
      ) : null}
      {shouldShowStatusBar({ error: state.error, loading: state.loading, status: state.status }) ? (
        <StatusBar
          error={state.error}
          loading={state.loading}
          status={state.status}
        />
      ) : null}
      <KeyHints />
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
  activeFilter: FilterCondition[];
  collectionDimensions: number;
  collectionPanelWidth: number;
  collections: Collection[];
  filterCursor: number;
  filterInput: string;
  filterOpen: boolean;
  focusedPanel: Panel;
  inspectedRecord: VectorRecord | null;
  loading: boolean;
  records: VectorRecord[];
  selectedCollectionIndex: number;
  selectedRecordIndex: number;
  statusBarVisible: boolean;
  tableSchema: TableSchema;
}

function MainView({
  activeFilter,
  collectionDimensions,
  collectionPanelWidth,
  collections,
  filterCursor,
  filterInput,
  filterOpen,
  focusedPanel,
  inspectedRecord,
  loading,
  records,
  selectedCollectionIndex,
  selectedRecordIndex,
  statusBarVisible,
  tableSchema,
}: MainViewProps) {
  const { width, height } = useTerminalDimensions();
  const recordContentWidth = Math.max(40, width - collectionPanelWidth - 4);
  const headerHeight = 3;
  const footerHeight = 1;
  const filterBarHeight = filterOpen ? 3 : 0;
  const statusBarHeight = statusBarVisible ? 3 : 0;
  const availableHeight = Math.max(10, height - headerHeight - footerHeight - filterBarHeight - statusBarHeight);
  const inspectorHeight = Math.max(5, Math.floor(availableHeight * 0.35));
  const recordsHeight = availableHeight - inspectorHeight;

  return (
    <box height={availableHeight + filterBarHeight} flexDirection="column">
      {filterOpen ? <FilterBar input={filterInput} cursor={filterCursor} /> : null}
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
            activeFilter={activeFilter}
            contentWidth={recordContentWidth}
            focused={focusedPanel === "records"}
            height={recordsHeight}
            loading={loading}
            records={records}
            schema={tableSchema}
            selectedIndex={selectedRecordIndex}
          />
          <Inspector
            collectionDimensions={collectionDimensions}
            focused={focusedPanel === "inspector"}
            height={inspectorHeight}
            record={inspectedRecord}
          />
        </box>
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

function FilterBar({ input, cursor }: { input: string; cursor: number }) {
  const before = input.slice(0, cursor);
  const at = input[cursor] ?? " ";
  const after = input.slice(cursor + 1);

  return (
    <box
      border
      borderColor={colors.accent}
      backgroundColor={colors.statusBg}
      flexDirection="row"
      height={3}
      paddingX={1}
      alignItems="center"
    >
      <text fg={colors.muted} bg={colors.statusBg}>{"/ "}</text>
      <text fg={colors.text} bg={colors.statusBg}>{before}</text>
      <text fg={colors.statusBg} bg={colors.accent}>{at}</text>
      <text fg={colors.text} bg={colors.statusBg}>{after}</text>
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
  activeFilter: FilterCondition[];
  contentWidth: number;
  focused: boolean;
  height: number;
  loading: boolean;
  records: VectorRecord[];
  schema: TableSchema;
  selectedIndex: number;
}

function RecordTable({ activeFilter, contentWidth, focused, height, loading, records, schema, selectedIndex }: RecordTableProps) {
  const panelChrome = 4;
  const visibleRows = Math.max(5, height - panelChrome);
  const visibleRecords = visibleRecordWindow(records, selectedIndex, visibleRows);
  const emptyMessage = recordTableEmptyMessage({
    loading,
    recordCount: records.length,
  });

  const filterSuffix = activeFilter.length > 0 ? " (filtered)" : "";
  const title = `Records (${records.length})${filterSuffix}`;
  const header = formatTableHeader(schema, contentWidth);

  return (
    <PanelFrame focused={focused} height={height} title={title}>
      <box flexDirection="column" flexGrow={1}>
        {emptyMessage === null ? null : <text fg={colors.muted}>{emptyMessage}</text>}
        {records.length > 0 ? <text fg={colors.accent}>{header}</text> : null}
        {visibleRecords.records.map((record, visibleIndex) => {
          const index = visibleRecords.startIndex + visibleIndex;
          const selected = index === selectedIndex;
          const line = formatRecordTableRow(record, selected, schema, contentWidth);

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
  height: number;
  record: VectorRecord | null;
}

function Inspector({ collectionDimensions, focused, height, record }: InspectorProps) {
  if (record === null) {
    return (
      <PanelFrame focused={focused} height={height} title="Inspector">
        <text fg={colors.muted}>Select a record to inspect payload.</text>
      </PanelFrame>
    );
  }

  const payloadJson = JSON.stringify(record.metadata, null, 2);
  const syntaxStyle = useMemo(() => SyntaxStyle.create(), []);
  const vectorPreview = formatInspectorVectorPreview(record.vector);

  return (
    <PanelFrame focused={focused} height={height} title="Inspector">
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

interface HelpEntry {
  action: string;
  key: string;
}

interface HelpSection {
  title: string;
  entries: HelpEntry[];
}

const connectionHelpSections: HelpSection[] = [
  {
    title: "Navigation",
    entries: [
      { action: "Move selection", key: "j / k" },
      { action: "Connect", key: "Enter" },
    ],
  },
  {
    title: "General",
    entries: [
      { action: "Toggle help", key: "?" },
      { action: "Quit", key: "q / Ctrl+C" },
    ],
  },
];

const mainHelpSections: HelpSection[] = [
  {
    title: "Navigation",
    entries: [
      { action: "Cycle panel focus", key: "Tab" },
      { action: "Cycle panel back", key: "Shift+Tab" },
      { action: "Move selection", key: "j / k" },
      { action: "Inspect record", key: "Enter" },
    ],
  },
  {
    title: "Data",
    entries: [
      { action: "Next record page", key: "n / PageDown" },
      { action: "Refresh collection", key: "r" },
      { action: "Back to connections", key: "Esc / c" },
    ],
  },
  {
    title: "Filter",
    entries: [
      { action: "Open filter", key: "/" },
      { action: "Apply filter", key: "Enter" },
      { action: "Clear filter / close", key: "Esc" },
    ],
  },
  {
    title: "Layout",
    entries: [
      { action: "Resize collection panel", key: "[ / ]" },
    ],
  },
  {
    title: "General",
    entries: [
      { action: "Toggle help", key: "?" },
      { action: "Quit", key: "q / Ctrl+C" },
    ],
  },
];

const helpActionWidth = 28;

function formatHelpLine(entry: HelpEntry): string {
  return `${entry.action.padEnd(helpActionWidth)}${entry.key}`;
}

interface HelpOverlayProps {
  screen: Screen;
}

function HelpOverlay({ screen }: HelpOverlayProps) {
  const sections = screen === "connections" ? connectionHelpSections : mainHelpSections;

  return (
    <box
      border
      borderColor={colors.accent}
      backgroundColor={colors.statusBg}
      title="Keys"
      width={50}
      paddingX={2}
      paddingY={1}
      flexDirection="column"
      gap={1}
    >
      {sections.map((section) => (
        <box key={section.title} flexDirection="column">
          <text fg={colors.accent}>{section.title}</text>
          {section.entries.map((entry) => (
            <text key={entry.action} fg={colors.text}>
              {"  "}{formatHelpLine(entry)}
            </text>
          ))}
        </box>
      ))}
      <text fg={colors.muted}>{"? or Esc to close"}</text>
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

function KeyHints() {
  return (
    <box height={1} flexDirection="row" paddingX={1}>
      <text fg={colors.muted}>{"? help"}</text>
    </box>
  );
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
