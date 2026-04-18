import type { Collection, CollectionStats, SearchResult, VectorPage, VectorRecord } from "../adapters/types";
import { createAdapter as createDefaultAdapter } from "../adapters/registry";
import type { BrowserData } from "../app-data/browser-data";
import { connectionFormFieldKeys, fieldMaxLength, type ConnectionFormCursors, type ConnectionFormFields } from "../components/ConnectionForm";
import { clamp } from "../format";
import { defaultCollectionPanelWidth, resizeCollectionPanelWidth } from "../layout/collection-panel";
import { inferTableSchema, type TableSchema } from "../layout/metadata-schema";
import type { FilterCondition } from "../filter/parse";
import { formatFilterSummary } from "../filter/parse";
import type { ConnectionFormMode, ConnectionProfile, ConnectionState, ConnectionStatus, Panel, Provider, RightTab, Screen } from "../types";

export const selectableProviders: Provider[] = ["qdrant", "pinecone", "chroma"];

export const panelOrder: Panel[] = ["collections", "records", "inspector"];

export function panelOrderForTab(tab: RightTab): Panel[] {
  return ["collections", tab === "stats" ? "stats" : "records", "inspector"];
}
export const defaultPageSize = 50;
export const searchLimit = 20;
export const reachabilityPollIntervalMs = 5000;
export const EMPTY_STRING_SET: ReadonlySet<string> = new Set<string>();
export const emptyFormFields: ConnectionFormFields = {
  name: "",
  provider: "qdrant",
  url: "",
  apiKey: "",
  tenant: "",
  database: "",
};
const emptyFormCursors: ConnectionFormCursors = [0, 0, 0, 0, 0, 0];

export type TuiDimension = number | "auto" | `${number}%`;

export interface TextEditResult {
  value: string;
  cursor: number;
}

const BRACKETED_PASTE_PATTERN = /\x1b\[20[01]~/g;

function stripNonPrintable(sequence: string): string {
  const withoutPasteMarkers = sequence.replace(BRACKETED_PASTE_PATTERN, "");
  let out = "";
  for (const char of withoutPasteMarkers) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 0x20 && code !== 0x7f) {
      out += char;
    }
  }
  return out;
}

export function applyTextEditKey(
  key: { name?: string; sequence?: string; ctrl?: boolean; meta?: boolean },
  value: string,
  cursor: number,
  maxLength?: number,
): TextEditResult | null {
  if (key.name === "left") {
    return { value, cursor: Math.max(0, cursor - 1) };
  }
  if (key.name === "right") {
    return { value, cursor: Math.min(value.length, cursor + 1) };
  }
  if ((key.name === "backspace" || key.name === "delete") && cursor > 0) {
    return { value: value.slice(0, cursor - 1) + value.slice(cursor), cursor: cursor - 1 };
  }
  if (!key.sequence || key.ctrl || key.meta) {
    return null;
  }
  const insert = stripNonPrintable(key.sequence);
  if (insert.length === 0) {
    return null;
  }
  const remaining = maxLength === undefined ? insert : insert.slice(0, Math.max(0, maxLength - value.length));
  if (remaining.length === 0) {
    return null;
  }
  return {
    value: value.slice(0, cursor) + remaining + value.slice(cursor),
    cursor: cursor + remaining.length,
  };
}

export function routePaste(state: AppState, text: string): AppAction | null {
  if (state.connectionFormMode !== null) {
    const fieldIndex = state.connectionFormFocusedField;
    if (fieldIndex === 1) {
      return null;
    }
    const fieldKey = connectionFormFieldKeys[fieldIndex];
    if (fieldKey === undefined) {
      return null;
    }
    const value = state.connectionFormFields[fieldKey];
    const cursor = state.connectionFormCursors[fieldIndex] ?? 0;
    const edit = applyTextEditKey({ sequence: text }, value, cursor, fieldMaxLength);
    if (edit === null) {
      return null;
    }
    return { type: "UPDATE_CONNECTION_FORM_FIELD", fieldIndex, value: edit.value, cursor: edit.cursor };
  }

  if (state.filterOpen) {
    const edit = applyTextEditKey({ sequence: text }, state.filterInput, state.filterCursor);
    if (edit === null) {
      return null;
    }
    return { type: "UPDATE_FILTER_INPUT", value: edit.value, cursor: edit.cursor };
  }

  return null;
}

function clearedSearchState(): Pick<AppState, "tableSchema" | "searchResults" | "searchSourceId" | "visualAnchor" | "selectedRecordIds" | "deleteConfirmOpen"> {
  return {
    tableSchema: { columns: [] },
    searchResults: null,
    searchSourceId: null,
    visualAnchor: null,
    selectedRecordIds: EMPTY_STRING_SET as Set<string>,
    deleteConfirmOpen: false,
  };
}

export interface AppState {
  screen: Screen;
  connections: ConnectionProfile[];
  selectedConnectionIndex: number;
  selectedCollectionIndex: number;
  selectedRecordIndex: number;
  focusedPanel: Panel;
  activeRightTab: RightTab;
  collectionStats: Record<string, CollectionStats>;
  statsLoading: boolean;
  statsError: string | null;
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
  searchResults: SearchResult[] | null;
  searchSourceId: string | null;
  yankPending: boolean;
  visualAnchor: number | null;
  selectedRecordIds: Set<string>;
  deleteConfirmOpen: boolean;
  filterOpen: boolean;
  filterInput: string;
  filterCursor: number;
  activeFilter: FilterCondition[];
  recordCursor?: string;
  connectionFormMode: ConnectionFormMode | null;
  connectionFormFields: ConnectionFormFields;
  connectionFormFocusedField: number;
  connectionFormCursors: ConnectionFormCursors;
  connectionFormError: string | null;
  connectionDeleteConfirmOpen: boolean;
}

export type AppAction =
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
  | { type: "CLEAR_FILTER" }
  | { type: "SEARCH_SIMILAR_REQUEST"; sourceId: string }
  | { type: "SEARCH_SIMILAR_SUCCESS"; results: SearchResult[]; sourceId: string }
  | { type: "CLEAR_SEARCH" }
  | { type: "YANK_PENDING" }
  | { type: "YANK_COMPLETE"; message: string }
  | { type: "YANK_CANCEL" }
  | { type: "VISUAL_SELECT_START" }
  | { type: "VISUAL_SELECT_MOVE"; delta: number; recordCount: number }
  | { type: "VISUAL_SELECT_TOGGLE" }
  | { type: "VISUAL_SELECT_CANCEL" }
  | { type: "DELETE_CONFIRM_OPEN" }
  | { type: "DELETE_CONFIRM_CANCEL" }
  | { type: "DELETE_REQUEST" }
  | { type: "DELETE_SUCCESS"; deleted: number }
  | { type: "OPEN_CONNECTION_FORM"; mode: ConnectionFormMode; fields: ConnectionFormFields }
  | { type: "CLOSE_CONNECTION_FORM" }
  | { type: "UPDATE_CONNECTION_FORM_FIELD"; fieldIndex: number; value: string; cursor: number }
  | { type: "CYCLE_CONNECTION_FORM_FOCUS"; delta: number }
  | { type: "CYCLE_CONNECTION_FORM_PROVIDER"; delta: number }
  | { type: "SET_CONNECTION_FORM_ERROR"; error: string }
  | { type: "SAVE_CONNECTION_SUCCESS"; connections: ConnectionProfile[] }
  | { type: "OPEN_CONNECTION_DELETE_CONFIRM" }
  | { type: "CLOSE_CONNECTION_DELETE_CONFIRM" }
  | { type: "DELETE_CONNECTION_SUCCESS"; connections: ConnectionProfile[]; deletedIndex: number }
  | { type: "SET_RIGHT_TAB"; tab: RightTab }
  | { type: "STATS_LOAD_START" }
  | { type: "STATS_LOAD_SUCCESS"; collectionName: string; stats: CollectionStats }
  | { type: "STATS_LOAD_FAILURE"; error: string }
  | { type: "INVALIDATE_STATS"; collectionNames: string[] };

export interface AppProps {
  connectionState: ConnectionState;
  createAdapter?: typeof createDefaultAdapter;
  pageSize?: number;
  cliArgs?: string[];
}

export function createInitialState(connections: ConnectionProfile[]): AppState {
  return {
    screen: "connections",
    connections,
    selectedConnectionIndex: 0,
    selectedCollectionIndex: 0,
    selectedRecordIndex: 0,
    focusedPanel: "collections",
    activeRightTab: "records",
    collectionStats: {},
    statsLoading: false,
    statsError: null,
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
    searchResults: null,
    searchSourceId: null,
    yankPending: false,
    visualAnchor: null,
    selectedRecordIds: EMPTY_STRING_SET as Set<string>,
    deleteConfirmOpen: false,
    filterOpen: false,
    filterInput: "",
    filterCursor: 0,
    activeFilter: [],
    connectionFormMode: null,
    connectionFormFields: emptyFormFields,
    connectionFormFocusedField: 0,
    connectionFormCursors: [...emptyFormCursors],
    connectionFormError: null,
    connectionDeleteConfirmOpen: false,
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
        ...clearedSearchState(),
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
        ...clearedSearchState(),
        screen: "connections",
        focusedPanel: "collections",
        collections: [],
        records: [],
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
      const order = panelOrderForTab(state.activeRightTab);
      const currentIndex = Math.max(0, order.indexOf(state.focusedPanel));
      const nextIndex = (currentIndex + action.delta + order.length) % order.length;
      const focusedPanel = order[nextIndex] ?? "collections";

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
        ...clearedSearchState(),
        selectedCollectionIndex: action.index,
        selectedRecordIndex: 0,
        records: [],
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
        tableSchema: state.tableSchema.columns.length > 0 ? state.tableSchema : inferTableSchema(action.page.records),
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

    case "SEARCH_SIMILAR_REQUEST":
      return {
        ...state,
        loading: true,
        error: null,
        searchSourceId: action.sourceId,
        status: `Searching for records similar to ${action.sourceId}...`,
      };

    case "SEARCH_SIMILAR_SUCCESS": {
      const records = action.results.map((r) => r.record);
      return {
        ...state,
        records,
        tableSchema: inferTableSchema(records),
        searchResults: action.results,
        searchSourceId: action.sourceId,
        selectedRecordIndex: 0,
        inspectedRecord: null,
        recordCursor: undefined,
        loading: false,
        error: null,
        status: `Found ${action.results.length} similar records.`,
      };
    }

    case "CLEAR_SEARCH":
      return {
        ...state,
        searchResults: null,
        searchSourceId: null,
        selectedRecordIndex: 0,
        records: [],
        inspectedRecord: null,
        loading: true,
        error: null,
        status: "",
      };

    case "YANK_PENDING":
      return {
        ...state,
        yankPending: true,
        status: "yank: i=id  m=metadata  v=vector",
      };

    case "YANK_COMPLETE":
      return {
        ...state,
        yankPending: false,
        status: action.message,
      };

    case "YANK_CANCEL":
      return {
        ...state,
        yankPending: false,
        status: "",
      };

    case "VISUAL_SELECT_START":
      return {
        ...state,
        visualAnchor: state.selectedRecordIndex,
        selectedRecordIds: new Set<string>([state.records[state.selectedRecordIndex]?.id].filter(Boolean) as string[]),
        status: "VISUAL — move to extend, Space to toggle, d to delete, Esc to cancel",
      };

    case "VISUAL_SELECT_MOVE": {
      if (state.visualAnchor === null || action.recordCount === 0) {
        return state;
      }

      const newIndex = clamp(state.selectedRecordIndex + action.delta, 0, action.recordCount - 1);
      const lo = Math.min(state.visualAnchor, newIndex);
      const hi = Math.max(state.visualAnchor, newIndex);
      const ids = new Set<string>();
      for (let i = lo; i <= hi; i++) {
        const id = state.records[i]?.id;
        if (id !== undefined) {
          ids.add(id);
        }
      }

      return {
        ...state,
        selectedRecordIndex: newIndex,
        selectedRecordIds: ids,
        inspectedRecord: null,
        status: `VISUAL — ${ids.size} selected`,
      };
    }

    case "VISUAL_SELECT_TOGGLE": {
      const id = state.records[state.selectedRecordIndex]?.id;
      if (id === undefined) {
        return state;
      }

      const ids = new Set(state.selectedRecordIds);
      if (ids.has(id)) {
        ids.delete(id);
      } else {
        ids.add(id);
      }

      return {
        ...state,
        selectedRecordIds: ids,
        status: ids.size > 0 ? `VISUAL — ${ids.size} selected` : "VISUAL — none selected",
      };
    }

    case "VISUAL_SELECT_CANCEL":
      return {
        ...state,
        visualAnchor: null,
        selectedRecordIds: EMPTY_STRING_SET as Set<string>,
        status: "",
      };

    case "DELETE_CONFIRM_OPEN":
      return {
        ...state,
        deleteConfirmOpen: true,
      };

    case "DELETE_CONFIRM_CANCEL":
      return {
        ...state,
        deleteConfirmOpen: false,
      };

    case "DELETE_REQUEST":
      return {
        ...state,
        deleteConfirmOpen: false,
        loading: true,
        status: "Deleting...",
      };

    case "DELETE_SUCCESS":
      return {
        ...state,
        visualAnchor: null,
        selectedRecordIds: EMPTY_STRING_SET as Set<string>,
        loading: false,
        status: `Deleted ${action.deleted} record(s).`,
      };

    case "OPEN_CONNECTION_FORM":
      return {
        ...state,
        connectionFormMode: action.mode,
        connectionFormFields: action.fields,
        connectionFormFocusedField: 0,
        connectionFormCursors: [
          action.fields.name.length,
          0,
          action.fields.url.length,
          action.fields.apiKey.length,
          action.fields.tenant.length,
          action.fields.database.length,
        ],
        connectionFormError: null,
      };

    case "CLOSE_CONNECTION_FORM":
      return {
        ...state,
        connectionFormMode: null,
        connectionFormFields: emptyFormFields,
        connectionFormFocusedField: 0,
        connectionFormCursors: [...emptyFormCursors],
        connectionFormError: null,
      };

    case "UPDATE_CONNECTION_FORM_FIELD": {
      const cursors = [...state.connectionFormCursors] as ConnectionFormCursors;
      cursors[action.fieldIndex] = action.cursor;

      const fields = { ...state.connectionFormFields };
      const key = connectionFormFieldKeys[action.fieldIndex];
      if (key !== undefined) {
        fields[key] = action.value;
      }

      return {
        ...state,
        connectionFormFields: fields,
        connectionFormCursors: cursors,
        connectionFormError: null,
      };
    }

    case "CYCLE_CONNECTION_FORM_FOCUS": {
      const fieldCount = connectionFormFieldKeys.length;
      const next = (state.connectionFormFocusedField + action.delta + fieldCount) % fieldCount;
      return {
        ...state,
        connectionFormFocusedField: next,
      };
    }

    case "CYCLE_CONNECTION_FORM_PROVIDER": {
      const providers = selectableProviders;
      const current = providers.indexOf(state.connectionFormFields.provider as Provider);
      const base = current === -1 ? 0 : current;
      const next = (base + action.delta + providers.length) % providers.length;
      return {
        ...state,
        connectionFormFields: { ...state.connectionFormFields, provider: providers[next]! },
        connectionFormError: null,
      };
    }

    case "SET_CONNECTION_FORM_ERROR":
      return {
        ...state,
        connectionFormError: action.error,
      };

    case "SAVE_CONNECTION_SUCCESS":
      return {
        ...state,
        connections: action.connections,
        connectionFormMode: null,
        connectionFormFields: emptyFormFields,
        connectionFormFocusedField: 0,
        connectionFormCursors: [...emptyFormCursors],
        connectionFormError: null,
        status: "Connection saved.",
      };

    case "OPEN_CONNECTION_DELETE_CONFIRM":
      return {
        ...state,
        connectionDeleteConfirmOpen: true,
      };

    case "CLOSE_CONNECTION_DELETE_CONFIRM":
      return {
        ...state,
        connectionDeleteConfirmOpen: false,
      };

    case "DELETE_CONNECTION_SUCCESS": {
      const newIndex = action.deletedIndex >= action.connections.length
        ? Math.max(0, action.connections.length - 1)
        : action.deletedIndex;

      return {
        ...state,
        connections: action.connections,
        connectionDeleteConfirmOpen: false,
        selectedConnectionIndex: newIndex,
        status: "Connection deleted.",
      };
    }

    case "SET_RIGHT_TAB": {
      const currentRightPanel = action.tab === "stats" ? "stats" : "records";
      const previousRightPanel = action.tab === "stats" ? "records" : "stats";
      const focusedPanel = state.focusedPanel === previousRightPanel ? currentRightPanel : state.focusedPanel;

      return {
        ...state,
        activeRightTab: action.tab,
        focusedPanel,
        statsError: action.tab === "records" ? null : state.statsError,
      };
    }

    case "STATS_LOAD_START":
      return {
        ...state,
        statsLoading: true,
        statsError: null,
      };

    case "STATS_LOAD_SUCCESS":
      return {
        ...state,
        statsLoading: false,
        statsError: null,
        collectionStats: {
          ...state.collectionStats,
          [action.collectionName]: action.stats,
        },
      };

    case "STATS_LOAD_FAILURE":
      return {
        ...state,
        statsLoading: false,
        statsError: action.error,
      };

    case "INVALIDATE_STATS": {
      if (action.collectionNames.length === 0) {
        return state;
      }
      const next = { ...state.collectionStats };
      for (const name of action.collectionNames) {
        delete next[name];
      }
      return {
        ...state,
        collectionStats: next,
      };
    }
  }
}
