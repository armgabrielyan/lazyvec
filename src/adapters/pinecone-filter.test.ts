import { describe, expect, test } from "bun:test";
import { toPineconeFilter } from "./pinecone-filter";

describe("toPineconeFilter", () => {
  test("empty input returns empty plan", () => {
    expect(toPineconeFilter([])).toEqual({ idFilter: [] });
  });

  test("collects id filters without building metadataFilter", () => {
    const plan = toPineconeFilter([
      { type: "id", value: "rec-1" },
      { type: "id", value: "rec-2" },
    ]);
    expect(plan).toEqual({ idFilter: ["rec-1", "rec-2"] });
  });

  test("single field filter bypasses $and wrapper", () => {
    const plan = toPineconeFilter([
      { type: "field", key: "status", operator: "eq", value: "active" },
    ]);
    expect(plan).toEqual({
      idFilter: [],
      metadataFilter: { status: { $eq: "active" } },
    });
  });

  test("multiple field filters combine with $and", () => {
    const plan = toPineconeFilter([
      { type: "field", key: "status", operator: "eq", value: "active" },
      { type: "field", key: "count", operator: "gt", value: 10 },
    ]);
    expect(plan).toEqual({
      idFilter: [],
      metadataFilter: {
        $and: [
          { status: { $eq: "active" } },
          { count: { $gt: 10 } },
        ],
      },
    });
  });

  test("maps all comparison operators", () => {
    const plan = toPineconeFilter([
      { type: "field", key: "a", operator: "gte", value: 1 },
      { type: "field", key: "b", operator: "lt", value: 2 },
      { type: "field", key: "c", operator: "lte", value: 3 },
      { type: "field", key: "d", operator: "neq", value: "x" },
    ]);
    expect(plan.metadataFilter).toEqual({
      $and: [
        { a: { $gte: 1 } },
        { b: { $lt: 2 } },
        { c: { $lte: 3 } },
        { d: { $ne: "x" } },
      ],
    });
  });

  test("range operators with non-numeric values are dropped", () => {
    const plan = toPineconeFilter([
      { type: "field", key: "price", operator: "gt", value: "free" },
    ]);
    expect(plan).toEqual({ idFilter: [] });
  });

  test("id and metadata filters coexist", () => {
    const plan = toPineconeFilter([
      { type: "id", value: "rec-7" },
      { type: "field", key: "tag", operator: "eq", value: "blue" },
    ]);
    expect(plan).toEqual({
      idFilter: ["rec-7"],
      metadataFilter: { tag: { $eq: "blue" } },
    });
  });
});
