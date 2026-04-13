import { describe, expect, test } from "bun:test";
import type { FilterCondition } from "../filter/parse";
import { toQdrantFilter } from "./qdrant-filter";

describe("toQdrantFilter", () => {
  test("returns undefined for empty conditions", () => {
    expect(toQdrantFilter([])).toBeUndefined();
  });

  test("converts exact string match to must with match", () => {
    const conditions: FilterCondition[] = [
      { type: "field", key: "status", operator: "eq", value: "active" },
    ];

    expect(toQdrantFilter(conditions)).toEqual({
      must: [{ key: "status", match: { value: "active" } }],
    });
  });

  test("converts exact numeric match to must with match", () => {
    const conditions: FilterCondition[] = [
      { type: "field", key: "count", operator: "eq", value: 42 },
    ];

    expect(toQdrantFilter(conditions)).toEqual({
      must: [{ key: "count", match: { value: 42 } }],
    });
  });

  test("converts greater than to must with range", () => {
    const conditions: FilterCondition[] = [
      { type: "field", key: "score", operator: "gt", value: 0.5 },
    ];

    expect(toQdrantFilter(conditions)).toEqual({
      must: [{ key: "score", range: { gt: 0.5 } }],
    });
  });

  test("converts greater than or equal to must with range", () => {
    const conditions: FilterCondition[] = [
      { type: "field", key: "count", operator: "gte", value: 10 },
    ];

    expect(toQdrantFilter(conditions)).toEqual({
      must: [{ key: "count", range: { gte: 10 } }],
    });
  });

  test("converts less than to must with range", () => {
    const conditions: FilterCondition[] = [
      { type: "field", key: "price", operator: "lt", value: 100 },
    ];

    expect(toQdrantFilter(conditions)).toEqual({
      must: [{ key: "price", range: { lt: 100 } }],
    });
  });

  test("converts less than or equal to must with range", () => {
    const conditions: FilterCondition[] = [
      { type: "field", key: "age", operator: "lte", value: 30 },
    ];

    expect(toQdrantFilter(conditions)).toEqual({
      must: [{ key: "age", range: { lte: 30 } }],
    });
  });

  test("converts not equal to must_not with match", () => {
    const conditions: FilterCondition[] = [
      { type: "field", key: "status", operator: "neq", value: "draft" },
    ];

    expect(toQdrantFilter(conditions)).toEqual({
      must_not: [{ key: "status", match: { value: "draft" } }],
    });
  });

  test("converts id filter to must with has_id", () => {
    const conditions: FilterCondition[] = [
      { type: "id", value: "abc-123" },
    ];

    expect(toQdrantFilter(conditions)).toEqual({
      must: [{ has_id: ["abc-123"] }],
    });
  });

  test("converts numeric id to number in has_id", () => {
    const conditions: FilterCondition[] = [
      { type: "id", value: "456" },
    ];

    expect(toQdrantFilter(conditions)).toEqual({
      must: [{ has_id: [456] }],
    });
  });

  test("combines multiple conditions into must and must_not", () => {
    const conditions: FilterCondition[] = [
      { type: "field", key: "status", operator: "eq", value: "active" },
      { type: "field", key: "score", operator: "gt", value: 0.5 },
      { type: "field", key: "category", operator: "neq", value: "spam" },
    ];

    expect(toQdrantFilter(conditions)).toEqual({
      must: [
        { key: "status", match: { value: "active" } },
        { key: "score", range: { gt: 0.5 } },
      ],
      must_not: [
        { key: "category", match: { value: "spam" } },
      ],
    });
  });

  test("ignores range operators with string values", () => {
    const conditions: FilterCondition[] = [
      { type: "field", key: "name", operator: "gt", value: "abc" as unknown as number },
    ];

    expect(toQdrantFilter(conditions)).toBeUndefined();
  });
});
