import type { ConnectionFormMode } from "../types";

const colors = {
  accent: "#7dd3fc",
  border: "#3f4655",
  error: "#fca5a5",
  muted: "#8b95a7",
  statusBg: "#10151f",
  text: "#e5e7eb",
};

export interface ConnectionFormFields {
  name: string;
  provider: string;
  url: string;
}

export interface ConnectionFormProps {
  mode: ConnectionFormMode;
  fields: ConnectionFormFields;
  focusedField: number;
  cursors: [number, number, number];
  error: string | null;
}

const fieldLabels = ["Name:", "Provider:", "URL:"];
const labelWidth = 10;
const fieldWidth = 36;
export const fieldMaxLength = fieldWidth - 1;

function TextInputField({ value, cursor, focused }: { value: string; cursor: number; focused: boolean }) {
  const before = value.slice(0, cursor);
  const at = value[cursor] ?? " ";
  const after = value.slice(cursor + 1);
  const borderColor = focused ? colors.accent : colors.border;
  const padLength = Math.max(0, fieldWidth - value.length - 1);
  const padding = " ".repeat(padLength);

  return (
    <box flexDirection="row" border borderColor={borderColor} height={3} width={fieldWidth + 2}>
      {focused ? (
        <>
          <text fg={colors.text} bg={colors.statusBg}>{before}</text>
          <text fg={colors.statusBg} bg={colors.accent}>{at}</text>
          <text fg={colors.text} bg={colors.statusBg}>{after}{padding}</text>
        </>
      ) : (
        <text fg={colors.text} bg={colors.statusBg}>{value}{" ".repeat(padLength + 1)}</text>
      )}
    </box>
  );
}

function ReadOnlyField({ value, focused }: { value: string; focused: boolean }) {
  const borderColor = focused ? colors.accent : colors.border;
  const display = `${value}${" ".repeat(Math.max(0, fieldWidth - value.length))}`;

  return (
    <box flexDirection="row" border borderColor={borderColor} height={3} width={fieldWidth + 2}>
      <text fg={colors.muted} bg={colors.statusBg}>{display}</text>
    </box>
  );
}

export function ConnectionForm({ mode, fields, focusedField, cursors, error }: ConnectionFormProps) {
  const title = mode.kind === "add" ? " Add Connection " : " Edit Connection ";

  return (
    <box
      border
      borderColor={colors.accent}
      backgroundColor={colors.statusBg}
      width={56}
      paddingX={2}
      paddingY={1}
      flexDirection="column"
      gap={0}
    >
      <text fg={colors.accent}>{title}</text>
      <text> </text>

      {fieldLabels.map((label, index) => (
        <box key={label} flexDirection="row" alignItems="center" height={3}>
          <text fg={focusedField === index ? colors.accent : colors.muted}>
            {label.padEnd(labelWidth)}
          </text>
          {index === 1 ? (
            <ReadOnlyField value={fields.provider} focused={focusedField === index} />
          ) : (
            <TextInputField
              value={index === 0 ? fields.name : fields.url}
              cursor={cursors[index] ?? 0}
              focused={focusedField === index}
            />
          )}
        </box>
      ))}

      <text> </text>
      {error ? <text fg={colors.error}>{error}</text> : null}
      <text fg={colors.muted}>Tab: next field  Enter: save  Esc: cancel</text>
    </box>
  );
}
