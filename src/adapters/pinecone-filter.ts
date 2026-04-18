import type { FieldFilter, FilterCondition } from "../filter/parse";

export interface PineconeFilterPlan {
  idFilter: string[];
  metadataFilter?: object;
}

export function toPineconeFilter(conditions: FilterCondition[]): PineconeFilterPlan {
  const idFilter: string[] = [];
  const fieldEntries: object[] = [];

  for (const condition of conditions) {
    if (condition.type === "id") {
      idFilter.push(condition.value);
      continue;
    }
    const entry = toFieldEntry(condition);
    if (entry !== null) {
      fieldEntries.push(entry);
    }
  }

  if (fieldEntries.length === 0) {
    return { idFilter };
  }
  if (fieldEntries.length === 1) {
    return { idFilter, metadataFilter: fieldEntries[0] };
  }
  return { idFilter, metadataFilter: { $and: fieldEntries } };
}

function toFieldEntry(condition: FieldFilter): object | null {
  const { key, value } = condition;
  switch (condition.operator) {
    case "eq":
      return { [key]: { $eq: value } };
    case "neq":
      return { [key]: { $ne: value } };
    case "gt":
      return typeof value === "number" ? { [key]: { $gt: value } } : null;
    case "gte":
      return typeof value === "number" ? { [key]: { $gte: value } } : null;
    case "lt":
      return typeof value === "number" ? { [key]: { $lt: value } } : null;
    case "lte":
      return typeof value === "number" ? { [key]: { $lte: value } } : null;
  }
}
