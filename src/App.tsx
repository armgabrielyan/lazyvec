import { useRenderer } from "@opentui/react";
import type { PasteEvent } from "@opentui/core";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { createAdapter as createDefaultAdapter } from "./adapters/registry";
import type { VectorDBAdapter } from "./adapters/types";
import {
  deleteRecords,
  loadCollectionRecords,
  loadCollectionStats,
  loadInitialBrowserData,
  loadNextCollectionRecords,
  loadRecordDetails,
  searchSimilarRecords,
} from "./app-data/browser-data";
import { ConnectionDeleteConfirm } from "./components/ConnectionDeleteConfirm";
import { ConnectionForm } from "./components/ConnectionForm";
import { ConnectionSelect } from "./components/ConnectionSelect";
import { Header, HelpOverlay, KeyHints, MainView, StatusBar } from "./components/MainView";
import { addConnectionToConfig, deleteConnectionFromConfig, updateConnectionInConfig, validateConnectionName, validateConnectionUrl } from "./config/config-writer";
import { checkConnectionReachable } from "./config/connection-status";
import { loadConnectionState } from "./config/connections";
import { clamp, toErrorMessage } from "./format";
import { inspectorRecordForSelection } from "./layout/inspector";
import { parseFilterInput } from "./filter/parse";
import { shouldShowStatusBar } from "./layout/view-state";
import { appReducer, createInitialState, defaultPageSize, reachabilityPollIntervalMs, routePaste, searchLimit, type AppProps } from "./state/app-state";
import { useAppKeyboard } from "./use-app-keyboard";

export { appReducer, createInitialState } from "./state/app-state";

export function App({
  connectionState,
  createAdapter = createDefaultAdapter,
  pageSize = defaultPageSize,
  cliArgs = process.argv.slice(2),
}: AppProps) {
  const renderer = useRenderer();
  const adapterRef = useRef<VectorDBAdapter | null>(null);
  const [state, dispatch] = useReducer(appReducer, connectionState.connections, createInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const connections = state.connections;
  const selectedConnection = connections[state.selectedConnectionIndex] ?? null;
  const selectedCollection = state.collections[state.selectedCollectionIndex] ?? null;
  const selectedRecord = state.records[state.selectedRecordIndex] ?? null;
  const inspectorRecord = inspectorRecordForSelection(state.inspectedRecord, selectedRecord);

  async function disconnectCurrentAdapter() {
    await adapterRef.current?.disconnect();
    adapterRef.current = null;
  }

  const runReachabilityCheck = useCallback((markChecking: boolean) => {
    for (const connection of connections) {
      if (markChecking) {
        dispatch({ type: "CONNECTION_STATUS_UPDATE", connectionId: connection.id, status: "checking" });
      }
      void checkConnectionReachable(connection).then((status) => {
        dispatch({ type: "CONNECTION_STATUS_UPDATE", connectionId: connection.id, status });
      });
    }
  }, [connections]);

  const refreshConnectionStatuses = useCallback(() => {
    runReachabilityCheck(true);
  }, [runReachabilityCheck]);

  useEffect(() => {
    if (state.screen !== "connections" || connections.length === 0) {
      return;
    }

    runReachabilityCheck(true);
    const interval = setInterval(() => runReachabilityCheck(false), reachabilityPollIntervalMs);
    return () => clearInterval(interval);
  }, [state.screen, runReachabilityCheck, connections.length]);

  useEffect(() => {
    if (
      state.screen !== "main" ||
      state.activeRightTab !== "stats" ||
      selectedCollection === null ||
      state.statsLoading
    ) {
      return;
    }
    if (state.collectionStats[selectedCollection.name] !== undefined) {
      return;
    }
    fetchCollectionStats(selectedCollection.name);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeRightTab, selectedCollection?.name, state.screen]);

  useEffect(() => {
    const decoder = new TextDecoder();
    const handler = (event: PasteEvent) => {
      const text = decoder.decode(event.bytes);
      const action = routePaste(stateRef.current, text);
      if (action !== null) {
        dispatch(action);
      }
    };
    renderer.keyInput.on("paste", handler);
    return () => {
      renderer.keyInput.off("paste", handler);
    };
  }, [renderer]);

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

  function fetchCollectionStats(collectionName: string) {
    const adapter = adapterRef.current;
    if (adapter === null) {
      return;
    }

    dispatch({ type: "STATS_LOAD_START" });
    void (async () => {
      try {
        const stats = await loadCollectionStats(adapter, collectionName);
        dispatch({ type: "STATS_LOAD_SUCCESS", collectionName, stats });
      } catch (error) {
        dispatch({ type: "STATS_LOAD_FAILURE", error: toErrorMessage(error) });
      }
    })();
  }

  function refreshCollectionStats() {
    if (selectedCollection === null) return;
    dispatch({ type: "INVALIDATE_STATS", collectionNames: [selectedCollection.name] });
    fetchCollectionStats(selectedCollection.name);
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
      dispatch({ type: "CLOSE_FILTER" });
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

  function searchSimilar() {
    const adapter = adapterRef.current;

    if (adapter === null || selectedCollection === null || selectedRecord === null) {
      return;
    }

    const recordToSearch = selectedRecord;
    dispatch({ type: "SEARCH_SIMILAR_REQUEST", sourceId: recordToSearch.id });

    void (async () => {
      try {
        let vector = recordToSearch.vector;

        if (vector === null) {
          const full = await loadRecordDetails(adapter, selectedCollection.name, recordToSearch.id);
          vector = full.vector;
        }

        if (vector === null) {
          dispatch({ type: "LOAD_FAILURE", error: "Record has no vector." });
          return;
        }

        const results = await searchSimilarRecords(adapter, selectedCollection.name, vector, searchLimit);
        dispatch({ type: "SEARCH_SIMILAR_SUCCESS", results, sourceId: recordToSearch.id });
      } catch (error) {
        dispatch({ type: "LOAD_FAILURE", error: toErrorMessage(error) });
      }
    })();
  }

  function clearSearch() {
    const adapter = adapterRef.current;

    if (adapter === null || selectedCollection === null) {
      return;
    }

    dispatch({ type: "CLEAR_SEARCH" });
    void (async () => {
      try {
        const page = await loadCollectionRecords(adapter, selectedCollection.name, { pageSize });
        dispatch({ type: "SELECT_COLLECTION_SUCCESS", index: state.selectedCollectionIndex, collectionName: selectedCollection.name, page });
      } catch (error) {
        dispatch({ type: "LOAD_FAILURE", error: toErrorMessage(error) });
      }
    })();
  }

  function deleteSelectedRecords() {
    const adapter = adapterRef.current;

    if (adapter === null || selectedCollection === null) {
      return;
    }

    const ids = state.selectedRecordIds.size > 0
      ? [...state.selectedRecordIds]
      : selectedRecord !== null ? [selectedRecord.id] : [];

    if (ids.length === 0) {
      return;
    }

    const collectionName = selectedCollection.name;
    const collectionIndex = state.selectedCollectionIndex;
    dispatch({ type: "DELETE_REQUEST" });
    void (async () => {
      try {
        const result = await deleteRecords(adapter, collectionName, ids);
        dispatch({ type: "DELETE_SUCCESS", deleted: result.deleted });
        const page = await loadCollectionRecords(adapter, collectionName, { pageSize });
        dispatch({ type: "SELECT_COLLECTION_SUCCESS", index: collectionIndex, collectionName, page });
      } catch (error) {
        dispatch({ type: "LOAD_FAILURE", error: toErrorMessage(error) });
      }
    })();
  }

  function saveConnection() {
    const { connectionFormMode: mode, connectionFormFields: fields } = state;
    if (mode === null) return;

    const nameError = validateConnectionName(fields.name);
    if (nameError) {
      dispatch({ type: "SET_CONNECTION_FORM_ERROR", error: nameError });
      return;
    }

    const provider = fields.provider as "qdrant" | "pinecone";
    if (provider === "pinecone") {
      if (fields.apiKey.length === 0) {
        dispatch({ type: "SET_CONNECTION_FORM_ERROR", error: "API Key is required for Pinecone" });
        return;
      }
    } else {
      const urlError = validateConnectionUrl(fields.url);
      if (urlError) {
        dispatch({ type: "SET_CONNECTION_FORM_ERROR", error: urlError });
        return;
      }
    }

    const input = {
      name: fields.name,
      provider,
      ...(provider !== "pinecone" && fields.url.length > 0 ? { url: fields.url } : {}),
      ...(fields.apiKey.length > 0 ? { apiKey: fields.apiKey } : {}),
    };
    const cliConnections = connections.filter((c) => c.source === "cli");

    void (async () => {
      try {
        if (mode.kind === "add") {
          await addConnectionToConfig(input);
        } else {
          const oldConnection = connections.find((c) => c.id === mode.connectionId);
          if (oldConnection) {
            await updateConnectionInConfig(oldConnection.name, input);
          }
        }

        const freshState = await loadConnectionState(cliArgs);
        const merged = [...cliConnections, ...freshState.connections.filter((c) => c.source === "config")];
        dispatch({ type: "SAVE_CONNECTION_SUCCESS", connections: merged });
      } catch (error) {
        dispatch({ type: "SET_CONNECTION_FORM_ERROR", error: toErrorMessage(error) });
      }
    })();
  }

  function deleteSelectedConnection() {
    const conn = selectedConnection;
    if (conn === null || conn.source !== "config") return;

    const deletedIndex = state.selectedConnectionIndex;
    const cliConnections = connections.filter((c) => c.source === "cli");

    dispatch({ type: "CLOSE_CONNECTION_DELETE_CONFIRM" });
    void (async () => {
      try {
        await deleteConnectionFromConfig(conn.name);
        const freshState = await loadConnectionState(cliArgs);
        const merged = [...cliConnections, ...freshState.connections.filter((c) => c.source === "config")];
        dispatch({ type: "DELETE_CONNECTION_SUCCESS", connections: merged, deletedIndex });
      } catch (error) {
        dispatch({ type: "LOAD_FAILURE", error: toErrorMessage(error) });
      }
    })();
  }

  useAppKeyboard({
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
    refreshCollectionStats,
    refreshConnectionStatuses,
    loadNextRecordPage,
    moveCollection,
  });

  return (
    <box flexDirection="column" width="100%" height="100%">
      {state.screen === "main" ? <Header connection={selectedConnection} /> : null}

      {state.screen === "connections" ? (
        <>
          <ConnectionSelect
            configPath={connectionState.onboarding.configPath}
            connections={connections}
            selectedIndex={state.selectedConnectionIndex}
            statuses={state.connectionStatuses}
          />
          {state.connectionFormMode !== null ? (
            <box position="absolute" width="100%" height="100%" alignItems="center" justifyContent="center">
              <ConnectionForm
                mode={state.connectionFormMode}
                fields={state.connectionFormFields}
                focusedField={state.connectionFormFocusedField}
                cursors={state.connectionFormCursors}
                error={state.connectionFormError}
              />
            </box>
          ) : null}
          {state.connectionDeleteConfirmOpen && selectedConnection !== null ? (
            <box position="absolute" width="100%" height="100%" alignItems="center" justifyContent="center">
              <ConnectionDeleteConfirm connectionName={selectedConnection.name} />
            </box>
          ) : null}
        </>
      ) : (
        <MainView
          activeFilter={state.activeFilter}
          activeRightTab={state.activeRightTab}
          collectionDimensions={selectedCollection?.dimensions ?? 0}
          collectionPanelWidth={state.collectionPanelWidth}
          collections={state.collections}
          collectionStats={selectedCollection === null ? null : state.collectionStats[selectedCollection.name] ?? null}
          deleteConfirmOpen={state.deleteConfirmOpen}
          filterCursor={state.filterCursor}
          filterInput={state.filterInput}
          filterOpen={state.filterOpen}
          focusedPanel={state.focusedPanel}
          inspectedRecord={inspectorRecord}
          loading={state.loading}
          records={state.records}
          selectedCollectionIndex={state.selectedCollectionIndex}
          selectedCollectionName={selectedCollection?.name ?? null}
          searchResults={state.searchResults}
          searchSourceId={state.searchSourceId}
          selectedRecordIds={state.selectedRecordIds}
          selectedRecordIndex={state.selectedRecordIndex}
          statsError={state.statsError}
          statsLoading={state.statsLoading}
          statusBarVisible={shouldShowStatusBar({ error: state.error, status: state.status })}
          tableSchema={state.tableSchema}
        />
      )}

      {state.showHelp ? (
        <box position="absolute" width="100%" height="100%" alignItems="center" justifyContent="center">
          <HelpOverlay screen={state.screen} />
        </box>
      ) : null}
      {shouldShowStatusBar({ error: state.error, status: state.status }) ? (
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
