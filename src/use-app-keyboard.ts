import { useKeyboard } from "@opentui/react";
import type { VectorRecord } from "./adapters/types";
import { copyToClipboard } from "./clipboard";
import { connectionFormFieldKeys, fieldMaxLength, type ConnectionFormFields } from "./components/ConnectionForm";
import { applyTextEditKey, emptyFormFields, type AppAction, type AppState } from "./state/app-state";
import type { ConnectionProfile } from "./types";

interface AppKeyboardDeps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  renderer: { destroy(): void };
  connections: ConnectionProfile[];
  selectedConnection: ConnectionProfile | null;
  selectedRecord: VectorRecord | null;
  connectSelectedConnection: () => void;
  disconnectCurrentAdapter: () => Promise<void>;
  saveConnection: () => void;
  deleteSelectedConnection: () => void;
  deleteSelectedRecords: () => void;
  applyFilter: () => void;
  clearFilter: () => void;
  clearSearch: () => void;
  searchSimilar: () => void;
  inspectSelectedRecord: () => void;
  refreshCurrentCollection: () => void;
  refreshConnectionStatuses: () => void;
  loadNextRecordPage: () => void;
  moveCollection: (delta: number) => void;
}

export function useAppKeyboard({
  state,
  dispatch,
  renderer,
  connections,
  selectedConnection,
  selectedRecord,
  connectSelectedConnection,
  disconnectCurrentAdapter,
  saveConnection,
  deleteSelectedConnection,
  deleteSelectedRecords,
  applyFilter,
  clearFilter,
  clearSearch,
  searchSimilar,
  inspectSelectedRecord,
  refreshCurrentCollection,
  refreshConnectionStatuses,
  loadNextRecordPage,
  moveCollection,
}: AppKeyboardDeps): void {
  useKeyboard((key) => {
    if (key.eventType === "release") {
      return;
    }

    if (key.ctrl && key.name === "c") {
      renderer.destroy();
      return;
    }

    const textInputActive = state.connectionFormMode !== null || state.filterOpen;
    if (key.name === "q" && !textInputActive) {
      renderer.destroy();
      return;
    }

    if (key.name === "?" || (key.shift && key.name === "/")) {
      dispatch({ type: "TOGGLE_HELP" });
      return;
    }

    if (key.name === "escape") {
      if (state.connectionFormMode !== null) {
        dispatch({ type: "CLOSE_CONNECTION_FORM" });
      } else if (state.connectionDeleteConfirmOpen) {
        dispatch({ type: "CLOSE_CONNECTION_DELETE_CONFIRM" });
      } else if (state.deleteConfirmOpen) {
        dispatch({ type: "DELETE_CONFIRM_CANCEL" });
      } else if (state.yankPending) {
        dispatch({ type: "YANK_CANCEL" });
      } else if (state.visualAnchor !== null) {
        dispatch({ type: "VISUAL_SELECT_CANCEL" });
      } else if (state.showHelp) {
        dispatch({ type: "TOGGLE_HELP" });
      } else if (state.filterOpen) {
        dispatch({ type: "CLOSE_FILTER" });
      } else if (state.searchResults !== null && state.screen === "main") {
        clearSearch();
      } else if (state.activeFilter.length > 0 && state.screen === "main") {
        clearFilter();
      } else if (state.screen === "main") {
        void disconnectCurrentAdapter();
        dispatch({ type: "BACK_TO_CONNECTIONS" });
      }
      return;
    }

    if (state.connectionFormMode !== null) {
      const fieldIndex = state.connectionFormFocusedField;
      const fieldKey = connectionFormFieldKeys[fieldIndex]!;
      const value = state.connectionFormFields[fieldKey];
      const cursor = state.connectionFormCursors[fieldIndex] ?? 0;

      if (key.name === "enter" || key.name === "return") {
        saveConnection();
      } else if (key.name === "tab") {
        dispatch({ type: "CYCLE_CONNECTION_FORM_FOCUS", delta: key.shift ? -1 : 1 });
      } else if (fieldIndex !== 1) {
        // Provider field is read-only; key events are intentionally dropped
        const edit = applyTextEditKey(key, value, cursor, fieldMaxLength);
        if (edit) {
          dispatch({ type: "UPDATE_CONNECTION_FORM_FIELD", fieldIndex, value: edit.value, cursor: edit.cursor });
        }
      }
      return;
    }

    if (state.connectionDeleteConfirmOpen) {
      if (key.name === "enter" || key.name === "return") {
        deleteSelectedConnection();
      }
      return;
    }

    if (state.deleteConfirmOpen) {
      if (key.name === "enter" || key.name === "return") {
        deleteSelectedRecords();
      }
      return;
    }

    if (state.filterOpen) {
      const { filterInput: input, filterCursor: cursor } = state;

      if (key.name === "enter" || key.name === "return") {
        applyFilter();
      } else {
        const edit = applyTextEditKey(key, input, cursor);
        if (edit) {
          dispatch({ type: "UPDATE_FILTER_INPUT", value: edit.value, cursor: edit.cursor });
        }
      }
      return;
    }

    if (state.yankPending) {
      const record = selectedRecord;
      const inspected = state.inspectedRecord;
      dispatch({ type: "YANK_CANCEL" });

      if (record === null) {
        return;
      }

      if (key.name === "i") {
        void copyToClipboard(record.id).then((ok) => {
          dispatch({ type: "YANK_COMPLETE", message: ok ? `Copied ID: ${record.id}` : "Clipboard not available." });
        });
      } else if (key.name === "m") {
        const metadata = inspected?.id === record.id ? inspected.metadata : record.metadata;
        const json = JSON.stringify(metadata, null, 2);
        void copyToClipboard(json).then((ok) => {
          dispatch({ type: "YANK_COMPLETE", message: ok ? "Copied metadata to clipboard." : "Clipboard not available." });
        });
      } else if (key.name === "v") {
        const vector = inspected?.id === record.id ? inspected.vector : record.vector;
        if (vector === null) {
          dispatch({ type: "YANK_COMPLETE", message: "No vector loaded. Press Enter to fetch first." });
        } else {
          const json = JSON.stringify(vector);
          void copyToClipboard(json).then((ok) => {
            dispatch({ type: "YANK_COMPLETE", message: ok ? "Copied vector to clipboard." : "Clipboard not available." });
          });
        }
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
        return;
      }

      if (key.name === "a") {
        dispatch({ type: "OPEN_CONNECTION_FORM", mode: { kind: "add" }, fields: { ...emptyFormFields } });
        return;
      }

      if (key.name === "e") {
        if (selectedConnection === null) return;
        if (selectedConnection.source !== "config") {
          dispatch({ type: "LOAD_FAILURE", error: "CLI connections cannot be edited." });
          return;
        }
        dispatch({
          type: "OPEN_CONNECTION_FORM",
          mode: { kind: "edit", connectionId: selectedConnection.id },
          fields: {
            name: selectedConnection.name,
            provider: selectedConnection.provider,
            url: selectedConnection.url,
            apiKey: selectedConnection.apiKey ?? "",
          },
        });
        return;
      }

      if (key.name === "d") {
        if (selectedConnection === null) return;
        if (selectedConnection.source !== "config") {
          dispatch({ type: "LOAD_FAILURE", error: "CLI connections cannot be deleted." });
          return;
        }
        dispatch({ type: "OPEN_CONNECTION_DELETE_CONFIRM" });
        return;
      }

      if (key.name === "r") {
        refreshConnectionStatuses();
        return;
      }

      return;
    }

    if (state.visualAnchor !== null) {
      if (key.name === "down" || key.name === "j") {
        dispatch({ type: "VISUAL_SELECT_MOVE", delta: 1, recordCount: state.records.length });
      } else if (key.name === "up" || key.name === "k") {
        dispatch({ type: "VISUAL_SELECT_MOVE", delta: -1, recordCount: state.records.length });
      } else if (key.name === "space" || key.sequence === " ") {
        dispatch({ type: "VISUAL_SELECT_TOGGLE" });
      } else if (key.name === "d") {
        dispatch({ type: "DELETE_CONFIRM_OPEN" });
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

    if (key.name === "s" && (state.focusedPanel === "records" || state.focusedPanel === "inspector")) {
      searchSimilar();
      return;
    }

    if (key.name === "y" && (state.focusedPanel === "records" || state.focusedPanel === "inspector")) {
      dispatch({ type: "YANK_PENDING" });
      return;
    }

    if (key.shift && key.name === "v" && state.focusedPanel === "records") {
      dispatch({ type: "VISUAL_SELECT_START" });
      return;
    }

    if (key.name === "d" && state.focusedPanel === "records") {
      dispatch({ type: "DELETE_CONFIRM_OPEN" });
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
}
