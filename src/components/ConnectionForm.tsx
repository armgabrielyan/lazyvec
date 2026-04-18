import { colors } from "../theme";
import type { ConnectionFormMode } from "../types";
import { visibleTextWindow } from "./text-input-window";

export interface ConnectionFormFields {
  name: string;
  provider: string;
  url: string;
  apiKey: string;
  tenant: string;
  database: string;
}

export type ConnectionFormCursors = [number, number, number, number, number, number];

export interface ConnectionFormProps {
  mode: ConnectionFormMode;
  fields: ConnectionFormFields;
  focusedField: number;
  cursors: ConnectionFormCursors;
  error: string | null;
}

export const connectionFormFieldKeys: (keyof ConnectionFormFields)[] = [
  "name",
  "provider",
  "url",
  "apiKey",
  "tenant",
  "database",
];

const qdrantFields: (keyof ConnectionFormFields)[] = ["name", "provider", "url", "apiKey"];
const pineconeFields: (keyof ConnectionFormFields)[] = ["name", "provider", "apiKey"];
const chromaFields: (keyof ConnectionFormFields)[] = [
  "name",
  "provider",
  "url",
  "apiKey",
  "tenant",
  "database",
];

export function visibleFieldKeys(provider: string): (keyof ConnectionFormFields)[] {
  if (provider === "pinecone") return pineconeFields;
  if (provider === "chroma") return chromaFields;
  return qdrantFields;
}

const labelWidth = 10;
const fieldWidth = 80;
const formWidth = labelWidth + fieldWidth + 8;
export const fieldMaxLength = 2048;

const fieldLabels: Record<keyof ConnectionFormFields, string> = {
  name: "Name:",
  provider: "Provider:",
  url: "URL:",
  apiKey: "API Key:",
  tenant: "Tenant:",
  database: "Database:",
};

function hintFor(fields: ConnectionFormFields): string {
  if (fields.provider === "pinecone") {
    return "Tab: next  Enter: save  Esc: cancel  (API Key required)";
  }
  if (fields.provider === "chroma") {
    return "Tab: next  Enter: save  Esc: cancel  (URL for local, API Key for Cloud; Tenant/Database optional)";
  }
  return "Tab: next  Enter: save  Esc: cancel";
}

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

function ProviderField({ value, focused }: { value: string; focused: boolean }) {
  const borderColor = focused ? colors.accent : colors.border;
  const leftArrow = focused ? "< " : "  ";
  const rightArrow = focused ? " >" : "  ";
  const inner = `${leftArrow}${value}${rightArrow}`;
  const padLength = Math.max(0, fieldWidth - inner.length);
  const display = `${inner}${" ".repeat(padLength)}`;
  const fg = focused ? colors.text : colors.muted;

  return (
    <box flexDirection="row" border borderColor={borderColor} height={3} width={fieldWidth + 2}>
      <text fg={fg} bg={colors.statusBg}>{display}</text>
    </box>
  );
}

export function ConnectionForm({ mode, fields, focusedField, cursors, error }: ConnectionFormProps) {
  const title = mode.kind === "add" ? " Add Connection " : " Edit Connection ";
  const visibleKeys = visibleFieldKeys(fields.provider);

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

      {visibleKeys.map((key) => {
        const absoluteIndex = connectionFormFieldKeys.indexOf(key);
        const focused = focusedField === absoluteIndex;
        return (
          <box key={key} flexDirection="row" alignItems="center" height={3}>
            <text fg={focused ? colors.accent : colors.muted}>
              {fieldLabels[key].padEnd(labelWidth)}
            </text>
            {key === "provider" ? (
              <ProviderField value={fields.provider} focused={focused} />
            ) : (
              <TextInputField
                value={fields[key]}
                cursor={cursors[absoluteIndex] ?? 0}
                focused={focused}
              />
            )}
          </box>
        );
      })}

      <text> </text>
      {error ? <text fg={colors.error}>{error}</text> : null}
      <text fg={colors.muted}>{hintFor(fields)}</text>
    </box>
  );
}
