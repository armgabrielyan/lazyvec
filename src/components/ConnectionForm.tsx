import { colors } from "../theme";
import type { ConnectionFormMode } from "../types";
import { visibleTextWindow } from "./text-input-window";

export interface ConnectionFormFields {
  name: string;
  provider: string;
  url: string;
  apiKey: string;
}

export type ConnectionFormCursors = [number, number, number, number];

export interface ConnectionFormProps {
  mode: ConnectionFormMode;
  fields: ConnectionFormFields;
  focusedField: number;
  cursors: ConnectionFormCursors;
  error: string | null;
}

export const connectionFormFieldKeys: (keyof ConnectionFormFields)[] = ["name", "provider", "url", "apiKey"];

const fieldLabels = ["Name:", "Provider:", "URL:", "API Key:"];
const labelWidth = 10;
const fieldWidth = 80;
const formWidth = labelWidth + fieldWidth + 8;
export const fieldMaxLength = 2048;

function TextInputField({ value, cursor, focused }: { value: string; cursor: number; focused: boolean }) {
  const { visible, localCursor } = visibleTextWindow(value, cursor, fieldWidth - 1);
  const before = visible.slice(0, localCursor);
  const at = visible[localCursor] ?? " ";
  const after = visible.slice(localCursor + 1);
  const borderColor = focused ? colors.accent : colors.border;
  const padLength = Math.max(0, fieldWidth - visible.length - 1);
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
        <text fg={colors.text} bg={colors.statusBg}>{visible}{" ".repeat(padLength + 1)}</text>
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
      width={formWidth}
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
              value={fields[connectionFormFieldKeys[index]!]}
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
