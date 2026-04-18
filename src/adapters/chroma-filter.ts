import type { FieldFilter, FilterCondition } from "../filter/parse";
import type { ChromaWhere } from "./chroma-client";

export interface ChromaFilterPlan {
  ids?: string[];
  where?: ChromaWhere;
}

export function toChromaFilter(conditions: FilterCondition[]): ChromaFilterPlan {
  const ids: string[] = [];
  const clauses: ChromaWhere[] = [];

  for (const condition of conditions) {
    if (condition.type === "id") {
      ids.push(condition.value);
      continue;
    }

    const clause = toFieldClause(condition);
    if (clause) {
      clauses.push(clause);
    }
  }

  const plan: ChromaFilterPlan = {};
  if (ids.length > 0) plan.ids = ids;
  if (clauses.length === 1) plan.where = clauses[0];
  else if (clauses.length > 1) plan.where = { $and: clauses };
  return plan;
}

function toFieldClause(condition: FieldFilter): ChromaWhere | null {
  const { key, operator, value } = condition;

  if (operator === "eq") {
    return { [key]: { $eq: value } };
  }

  if (operator === "neq") {
    return { [key]: { $ne: value } };
  }

  if (typeof value !== "number") {
    return null;
  }

  switch (operator) {
    case "gt":
      return { [key]: { $gt: value } };
    case "gte":
      return { [key]: { $gte: value } };
    case "lt":
      return { [key]: { $lt: value } };
    case "lte":
      return { [key]: { $lte: value } };
  }
}
