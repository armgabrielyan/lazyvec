import type { Panel, Screen } from "../types";

export type StatusTone = "ready" | "loading" | "error";

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

interface HeaderTextState {
  connectionName: string | null;
}

interface HeaderParts {
  connectionLabel: string;
  connectionName: string | null;
}

interface StatusBarVisibilityState {
  error: string | null;
  loading: boolean;
  screen: Screen;
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

export function headerParts({ connectionName }: HeaderTextState): HeaderParts {
  return {
    connectionLabel: "conn:",
    connectionName,
  };
}

export function shouldShowStatusBar({ error, loading, screen }: StatusBarVisibilityState): boolean {
  return screen === "main" || loading || error !== null;
}

export function formatStatusBarText({
  error,
  focusedPanel,
  loading,
  screen,
  status,
}: StatusBarTextState): string {
  const mode = screen === "connections" ? "connections" : `main:${focusedPanel}`;
  const state = statusTone({ error, loading });

  return `${mode}  ${state}  ${status}`;
}

export function statusTone({ error, loading }: { error: string | null; loading: boolean }): StatusTone {
  if (error !== null) {
    return "error";
  }

  return loading ? "loading" : "ready";
}
