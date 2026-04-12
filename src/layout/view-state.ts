import type { Panel, Screen } from "../types";

interface EmptyPanelState {
  loading: boolean;
}

interface CollectionPanelEmptyState extends EmptyPanelState {
  collectionCount: number;
}

interface RecordTableEmptyState extends EmptyPanelState {
  recordCount: number;
}

interface StatusBarTextState {
  error: string | null;
  focusedPanel: Panel;
  loading: boolean;
  screen: Screen;
  status: string;
}

export function collectionPanelEmptyMessage({
  collectionCount,
  loading,
}: CollectionPanelEmptyState): string | null {
  if (collectionCount > 0) {
    return null;
  }

  return loading ? "Loading collections..." : "No collections found.";
}

export function recordTableEmptyMessage({ loading, recordCount }: RecordTableEmptyState): string | null {
  if (recordCount > 0) {
    return null;
  }

  return loading ? "Loading records..." : "No records in this collection.";
}

export function formatStatusBarText({
  error,
  focusedPanel,
  loading,
  screen,
  status,
}: StatusBarTextState): string {
  const mode = screen === "connections" ? "connections" : `main:${focusedPanel}`;
  const state = error === null ? (loading ? "loading" : "ready") : "error";

  return `${mode}  ${state}  ${status}`;
}
