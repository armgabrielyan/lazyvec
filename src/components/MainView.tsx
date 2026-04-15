import { SyntaxStyle } from "@opentui/core";
import { useTerminalDimensions } from "@opentui/react";
import { useMemo } from "react";
import type { ReactNode } from "react";
import type { Collection, SearchResult, VectorRecord } from "../adapters/types";
import { pad } from "../format";
import { defaultCollectionPanelWidth, formatCollectionPanelRow } from "../layout/collection-panel";
import { formatInspectorVectorPreview } from "../layout/inspector";
import type { TableSchema } from "../layout/metadata-schema";
import { distributeColumnWidths, formatRecordTableRow, formatTableHeader, idColumnWidth, visibleRecordWindow } from "../layout/record-table";
import {
  collectionPanelEmptyMessage,
  formatStatusBarText,
  headerParts,
  recordTableEmptyMessage,
  shouldShowStatusBar,
  statusTone,
} from "../layout/view-state";
import type { TuiDimension } from "../state/app-state";
import { colors } from "../theme";
import type { ConnectionProfile, Panel, Screen } from "../types";
import type { FilterCondition } from "../filter/parse";

// --- Header ---

interface HeaderProps {
  connection: ConnectionProfile | null;
}

export function Header({ connection }: HeaderProps) {
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

// --- MainView ---

export interface MainViewProps {
  activeFilter: FilterCondition[];
  collectionDimensions: number;
  collectionPanelWidth: number;
  collections: Collection[];
  deleteConfirmOpen: boolean;
  filterCursor: number;
  filterInput: string;
  filterOpen: boolean;
  focusedPanel: Panel;
  inspectedRecord: VectorRecord | null;
  loading: boolean;
  records: VectorRecord[];
  searchResults: SearchResult[] | null;
  searchSourceId: string | null;
  selectedCollectionIndex: number;
  selectedRecordIds: Set<string>;
  selectedRecordIndex: number;
  statusBarVisible: boolean;
  tableSchema: TableSchema;
}

export function MainView({
  activeFilter,
  collectionDimensions,
  collectionPanelWidth,
  collections,
  deleteConfirmOpen,
  filterCursor,
  filterInput,
  filterOpen,
  focusedPanel,
  inspectedRecord,
  loading,
  records,
  searchResults,
  searchSourceId,
  selectedCollectionIndex,
  selectedRecordIds,
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
            searchResults={searchResults}
            searchSourceId={searchSourceId}
            selectedIndex={selectedRecordIndex}
            selectedRecordIds={selectedRecordIds}
          />
          <Inspector
            collectionDimensions={collectionDimensions}
            focused={focusedPanel === "inspector"}
            height={inspectorHeight}
            record={inspectedRecord}
          />
        </box>
      </box>
      {deleteConfirmOpen ? (
        <box position="absolute" width="100%" height="100%" alignItems="center" justifyContent="center">
          <DeleteConfirm count={selectedRecordIds.size > 0 ? selectedRecordIds.size : 1} />
        </box>
      ) : null}
    </box>
  );
}

// --- Shared frame ---

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

// --- Filter bar ---

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

// --- Collection panel ---

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

// --- Record table ---

interface RecordTableProps {
  activeFilter: FilterCondition[];
  contentWidth: number;
  focused: boolean;
  height: number;
  loading: boolean;
  records: VectorRecord[];
  schema: TableSchema;
  searchResults: SearchResult[] | null;
  searchSourceId: string | null;
  selectedIndex: number;
  selectedRecordIds: Set<string>;
}

function RecordTable({ activeFilter, contentWidth, focused, height, loading, records, schema, searchResults, searchSourceId, selectedIndex, selectedRecordIds }: RecordTableProps) {
  const panelChrome = 4;
  const visibleRows = Math.max(5, height - panelChrome);
  const visibleRecords = visibleRecordWindow(records, selectedIndex, visibleRows);
  const emptyMessage = recordTableEmptyMessage({
    loading,
    recordCount: records.length,
  });

  const isSearchMode = searchResults !== null;
  const scoreMap = useMemo(() => {
    if (searchResults === null) {
      return null;
    }
    const map = new Map<string, number>();
    for (const result of searchResults) {
      map.set(result.record.id, result.score);
    }
    return map;
  }, [searchResults]);

  const scoreColumnWidth = 8;
  const dataWidth = isSearchMode ? contentWidth - scoreColumnWidth : contentWidth;

  const columnWidths = useMemo(
    () => schema.columns.length > 0 ? distributeColumnWidths(schema, dataWidth - idColumnWidth) : undefined,
    [schema, dataWidth],
  );

  const title = isSearchMode
    ? `Similar to ${searchSourceId} (${records.length})`
    : `Records (${records.length})${activeFilter.length > 0 ? " (filtered)" : ""}`;
  const header = formatTableHeader(schema, dataWidth, columnWidths);
  const scoreHeader = isSearchMode ? pad("score", scoreColumnWidth) : "";

  return (
    <PanelFrame focused={focused} height={height} title={title}>
      <box flexDirection="column" flexGrow={1}>
        {emptyMessage === null ? null : <text fg={colors.muted}>{emptyMessage}</text>}
        {records.length > 0 ? <text fg={colors.accent}>{scoreHeader}{header}</text> : null}
        {visibleRecords.records.map((record, visibleIndex) => {
          const index = visibleRecords.startIndex + visibleIndex;
          const selected = index === selectedIndex;
          const line = formatRecordTableRow(record, selected, schema, dataWidth, columnWidths);
          const scoreCell = scoreMap !== null
            ? pad(scoreMap.get(record.id)?.toFixed(4) ?? "-", scoreColumnWidth)
            : "";

          const inVisualSelection = selectedRecordIds.has(record.id);
          const fg = selected ? colors.text : inVisualSelection ? colors.text : colors.muted;
          const bg = selected ? colors.selectedBg : inVisualSelection ? colors.visualSelectBg : undefined;

          return (
            <text key={`${record.id}-${index}`} fg={fg} bg={bg}>
              {scoreCell}{line}
            </text>
          );
        })}
      </box>
    </PanelFrame>
  );
}

// --- Delete confirm ---

function DeleteConfirm({ count }: { count: number }) {
  const label = count === 1 ? "1 record" : `${count} records`;

  return (
    <box
      border
      borderColor={colors.error}
      backgroundColor={colors.statusBg}
      width={50}
      paddingX={2}
      paddingY={1}
      flexDirection="column"
      gap={1}
    >
      <text fg={colors.text}>Delete {label}?</text>
      <text fg={colors.error}>This action cannot be undone.</text>
      <text fg={colors.muted}>Enter to confirm / Esc to cancel</text>
    </box>
  );
}

// --- Inspector ---

interface InspectorProps {
  collectionDimensions: number;
  focused: boolean;
  height: number;
  record: VectorRecord | null;
}

function Inspector({ collectionDimensions, focused, height, record }: InspectorProps) {
  const syntaxStyle = useMemo(() => SyntaxStyle.create(), []);

  if (record === null) {
    return (
      <PanelFrame focused={focused} height={height} title="Inspector">
        <text fg={colors.muted}>Select a record to inspect payload.</text>
      </PanelFrame>
    );
  }

  const payloadJson = JSON.stringify(record.metadata, null, 2);
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

// --- Help overlay ---

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
    title: "Manage",
    entries: [
      { action: "Add connection", key: "a" },
      { action: "Edit connection", key: "e" },
      { action: "Delete connection", key: "d" },
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
      { action: "Find similar records", key: "s" },
      { action: "Yank (copy) ID", key: "y i" },
      { action: "Yank (copy) metadata", key: "y m" },
      { action: "Yank (copy) vector", key: "y v" },
      { action: "Delete record(s)", key: "d" },
      { action: "Visual select", key: "V" },
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

export function HelpOverlay({ screen }: HelpOverlayProps) {
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

// --- Status bar ---

interface StatusBarProps {
  error: string | null;
  loading: boolean;
  status: string;
}

export function StatusBar({ error, loading, status }: StatusBarProps) {
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

// --- Key hints ---

export function KeyHints() {
  return (
    <box height={1} flexDirection="row" paddingX={1}>
      <text fg={colors.muted}>{"? help"}</text>
    </box>
  );
}
