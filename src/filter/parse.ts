export type FilterOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte";

export interface FieldFilter {
  type: "field";
  key: string;
  operator: FilterOperator;
  value: string | number;
}

export interface IdFilter {
  type: "id";
  value: string;
}

export type FilterCondition = FieldFilter | IdFilter;

const operatorPrefixes: { prefix: string; operator: FilterOperator }[] = [
  { prefix: ">=", operator: "gte" },
  { prefix: "<=", operator: "lte" },
  { prefix: "!=", operator: "neq" },
  { prefix: ">", operator: "gt" },
  { prefix: "<", operator: "lt" },
];

export function parseFilterInput(input: string): FilterCondition[] {
  const tokens = tokenize(input);
  const conditions: FilterCondition[] = [];

  for (const token of tokens) {
    const colonIndex = token.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }

    const key = token.slice(0, colonIndex);
    const rawValue = unquote(token.slice(colonIndex + 1));

    if (key === "" || rawValue === "") {
      continue;
    }

    if (key === "id") {
      conditions.push({ type: "id", value: rawValue });
      continue;
    }

    const operatorMatch = operatorPrefixes.find((op) => rawValue.startsWith(op.prefix));

    if (operatorMatch) {
      const rest = rawValue.slice(operatorMatch.prefix.length);

      if (rest === "") {
        continue;
      }

      if (operatorMatch.operator === "neq") {
        const numValue = Number(rest);
        const value = !Number.isNaN(numValue) ? numValue : rest;
        conditions.push({ type: "field", key, operator: "neq", value });
        continue;
      }

      const numValue = Number(rest);
      if (!Number.isNaN(numValue)) {
        conditions.push({ type: "field", key, operator: operatorMatch.operator, value: numValue });
        continue;
      }
    }

    const numValue = Number(rawValue);
    const value = rawValue !== "" && !Number.isNaN(numValue) ? numValue : rawValue;

    conditions.push({ type: "field", key, operator: "eq", value });
  }

  return conditions;
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuote: '"' | "'" | null = null;

  for (const ch of input) {
    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inQuote = ch;
      continue;
    }

    if (ch === " " || ch === "\t") {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += ch;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function unquote(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

export function formatFilterSummary(conditions: FilterCondition[]): string {
  return conditions.map((c) => {
    if (c.type === "id") {
      return `id:${c.value}`;
    }

    const opSymbol = operatorSymbol(c.operator);
    const formatted = typeof c.value === "string" && c.value.includes(" ") ? `"${c.value}"` : c.value;
    return `${c.key}${opSymbol}${formatted}`;
  }).join(" ");
}

function operatorSymbol(operator: FilterOperator): string {
  switch (operator) {
    case "eq": return ":";
    case "neq": return ":!=";
    case "gt": return ":>";
    case "gte": return ":>=";
    case "lt": return ":<";
    case "lte": return ":<=";
  }
}
