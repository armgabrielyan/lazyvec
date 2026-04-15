import { colors } from "../theme";

interface ConnectionDeleteConfirmProps {
  connectionName: string;
}

export function ConnectionDeleteConfirm({ connectionName }: ConnectionDeleteConfirmProps) {
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
      <text fg={colors.text}>Delete connection '{connectionName}'?</text>
      <text fg={colors.error}>This will remove it from your config file.</text>
      <text fg={colors.muted}>Enter to confirm / Esc to cancel</text>
    </box>
  );
}
