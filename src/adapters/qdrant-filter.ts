import type { FieldFilter, FilterCondition, IdFilter } from "../filter/parse";

export interface QdrantFilter {
  must?: QdrantCondition[];
  must_not?: QdrantCondition[];
}

export type QdrantCondition =
  | { key: string; match: { value: string | number } }
  | { key: string; range: QdrantRange }
  | { has_id: (string | number)[] };

interface QdrantRange {
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
}

export function toQdrantFilter(conditions: FilterCondition[]): QdrantFilter | undefined {
  if (conditions.length === 0) {
    return undefined;
  }

  const must: QdrantCondition[] = [];
  const mustNot: QdrantCondition[] = [];

  for (const condition of conditions) {
    if (condition.type === "id") {
      must.push(toIdCondition(condition));
      continue;
    }

    if (condition.operator === "neq") {
      mustNot.push(toMatchCondition(condition));
      continue;
    }

    const mapped = toFieldCondition(condition);
    if (mapped) {
      must.push(mapped);
    }
  }

  const filter: QdrantFilter = {};
  if (must.length > 0) filter.must = must;
  if (mustNot.length > 0) filter.must_not = mustNot;

  return Object.keys(filter).length > 0 ? filter : undefined;
}

function toIdCondition(condition: IdFilter): QdrantCondition {
  const id = /^\d+$/.test(condition.value) ? Number(condition.value) : condition.value;
  return { has_id: [id] };
}

function toMatchCondition(condition: FieldFilter): QdrantCondition {
  return { key: condition.key, match: { value: condition.value } };
}

function toFieldCondition(condition: FieldFilter): QdrantCondition | null {
  switch (condition.operator) {
    case "eq":
      return { key: condition.key, match: { value: condition.value } };

    case "gt":
      return typeof condition.value === "number"
        ? { key: condition.key, range: { gt: condition.value } }
        : null;

    case "gte":
      return typeof condition.value === "number"
        ? { key: condition.key, range: { gte: condition.value } }
        : null;

    case "lt":
      return typeof condition.value === "number"
        ? { key: condition.key, range: { lt: condition.value } }
        : null;

    case "lte":
      return typeof condition.value === "number"
        ? { key: condition.key, range: { lte: condition.value } }
        : null;

    case "neq":
      return null;
  }
}
