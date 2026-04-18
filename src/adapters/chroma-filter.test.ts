import { describe, expect, test } from "bun:test";
import { toChromaFilter } from "./chroma-filter";

describe("toChromaFilter", () => {
  test("returns empty plan for no conditions", () => {
    expect(toChromaFilter([])).toEqual({});
  });

  test("collects id filters into ids[]", () => {
    expect(
      toChromaFilter([
        { type: "id", value: "rec-1" },
        { type: "id", value: "rec-2" },
      ]),
    ).toEqual({ ids: ["rec-1", "rec-2"] });
  });

  test("single eq condition becomes a flat where clause", () => {
    expect(
      toChromaFilter([{ type: "field", key: "status", operator: "eq", value: "ok" }]),
    ).toEqual({ where: { status: { $eq: "ok" } } });
  });

  test("multiple conditions are wrapped in $and", () => {
    expect(
      toChromaFilter([
        { type: "field", key: "status", operator: "eq", value: "ok" },
        { type: "field", key: "score", operator: "gt", value: 5 },
      ]),
    ).toEqual({
      where: {
        $and: [{ status: { $eq: "ok" } }, { score: { $gt: 5 } }],
      },
    });
  });

  test("maps range operators for numeric values", () => {
    expect(
      toChromaFilter([
        { type: "field", key: "a", operator: "gte", value: 1 },
        { type: "field", key: "b", operator: "lt", value: 2 },
        { type: "field", key: "c", operator: "lte", value: 3 },
      ]).where,
    ).toEqual({
      $and: [
        { a: { $gte: 1 } },
        { b: { $lt: 2 } },
        { c: { $lte: 3 } },
      ],
    });
  });

  test("drops non-numeric comparisons", () => {
    const plan = toChromaFilter([
      { type: "field", key: "tag", operator: "gt", value: "abc" },
    ]);
    expect(plan.where).toBeUndefined();
  });

  test("neq becomes $ne and allows string values", () => {
    expect(
      toChromaFilter([{ type: "field", key: "status", operator: "neq", value: "gone" }]),
    ).toEqual({ where: { status: { $ne: "gone" } } });
  });

  test("merges ids with field conditions", () => {
    const plan = toChromaFilter([
      { type: "id", value: "rec-7" },
      { type: "field", key: "status", operator: "eq", value: "ok" },
    ]);
    expect(plan).toEqual({
      ids: ["rec-7"],
      where: { status: { $eq: "ok" } },
    });
  });
});
