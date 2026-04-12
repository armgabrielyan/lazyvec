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

export function headerParts({ connectionName }: HeaderTextState): HeaderParts {
  return {
    connectionLabel: "conn:",
    connectionName,
  };
}

export function shouldShowStatusBar({ error, loading, status }: StatusBarVisibilityState): boolean {
  const hasMessage = status.trim().length > 0;
  return error !== null || hasMessage;
}

export function formatStatusBarText({ status }: StatusBarTextState): string {
  return status;
}

export function statusTone({ error, loading }: { error: string | null; loading: boolean }): StatusTone {
  if (error !== null) {
    return "error";
  }

  return loading ? "loading" : "ready";
}
