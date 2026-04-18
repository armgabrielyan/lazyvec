import type { CollectionStats } from "../adapters/types";
import { buildStatsSections } from "../layout/collection-stats";
import { colors } from "../theme";
import type { RightTab } from "../types";

export interface CollectionStatsPanelProps {
  collectionName: string | null;
  error: string | null;
  focused: boolean;
  height: number;
  loading: boolean;
  stats: CollectionStats | null;
}

export function CollectionStatsPanel({ collectionName, error, focused, height, loading, stats }: CollectionStatsPanelProps) {
  const title = collectionName === null ? "Stats" : `Stats — ${collectionName}`;

  return (
    <box
      border
      borderColor={focused ? colors.focus : colors.border}
      flexDirection="column"
      height={height}
      paddingX={1}
      title={focused ? `${title} *` : title}
    >
      <StatsBody collectionName={collectionName} error={error} loading={loading} stats={stats} />
    </box>
  );
}

interface StatsBodyProps {
  collectionName: string | null;
  error: string | null;
  loading: boolean;
  stats: CollectionStats | null;
}

function StatsBody({ collectionName, error, loading, stats }: StatsBodyProps) {
  if (collectionName === null) {
    return <text fg={colors.muted}>Select a collection to view stats.</text>;
  }

  if (loading && stats === null) {
    return <text fg={colors.muted}>Loading stats…</text>;
  }

  if (error !== null && stats === null) {
    return <text fg={colors.error}>{error}</text>;
  }

  if (stats === null) {
    return <text fg={colors.muted}>No stats available.</text>;
  }

  const sections = buildStatsSections(stats);

  return (
    <scrollbox flexGrow={1}>
      {sections.map((section, sectionIndex) => (
        <box key={section.title} flexDirection="column" marginBottom={sectionIndex === sections.length - 1 ? 0 : 1}>
          <text fg={colors.accent}>{section.title}</text>
          {section.rows.map((row) => (
            <text key={row.label} fg={colors.text}>
              {`  ${row.label.padEnd(24)}${row.value}`}
            </text>
          ))}
        </box>
      ))}
    </scrollbox>
  );
}

export interface RightTabBarProps {
  activeTab: RightTab;
  focused: boolean;
  recordCount: number;
}

export function RightTabBar({ activeTab, focused, recordCount }: RightTabBarProps) {
  return (
    <box flexDirection="row" height={1} paddingX={1}>
      <TabLabel active={activeTab === "records"} focused={focused && activeTab === "records"} label={`Records (${recordCount})`} />
      <text fg={colors.muted}>{"  "}</text>
      <TabLabel active={activeTab === "stats"} focused={focused && activeTab === "stats"} label="Stats" />
    </box>
  );
}

interface TabLabelProps {
  active: boolean;
  focused: boolean;
  label: string;
}

function TabLabel({ active, focused, label }: TabLabelProps) {
  const fg = active ? (focused ? colors.focus : colors.accent) : colors.muted;
  return <text fg={fg}>{active ? `[${label}]` : ` ${label} `}</text>;
}
