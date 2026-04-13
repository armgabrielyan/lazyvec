import { describe, expect, test } from "bun:test";
import { formatFilterSummary, parseFilterInput } from "./parse";
import type { FilterCondition } from "./parse";

describe("parseFilterInput", () => {
  test("parses exact string match", () => {
    expect(parseFilterInput("status:active")).toEqual([
      { type: "field", key: "status", operator: "eq", value: "active" },
    ]);
  });

  test("parses exact numeric match", () => {
    expect(parseFilterInput("count:42")).toEqual([
      { type: "field", key: "count", operator: "eq", value: 42 },
    ]);
  });

  test("parses greater than", () => {
    expect(parseFilterInput("score:>0.5")).toEqual([
      { type: "field", key: "score", operator: "gt", value: 0.5 },
    ]);
  });

  test("parses greater than or equal", () => {
    expect(parseFilterInput("count:>=10")).toEqual([
      { type: "field", key: "count", operator: "gte", value: 10 },
    ]);
  });

  test("parses less than", () => {
    expect(parseFilterInput("price:<100")).toEqual([
      { type: "field", key: "price", operator: "lt", value: 100 },
    ]);
  });

  test("parses less than or equal", () => {
    expect(parseFilterInput("age:<=30")).toEqual([
      { type: "field", key: "age", operator: "lte", value: 30 },
    ]);
  });

  test("parses not equal with string value", () => {
    expect(parseFilterInput("status:!=draft")).toEqual([
      { type: "field", key: "status", operator: "neq", value: "draft" },
    ]);
  });

  test("parses not equal with numeric value", () => {
    expect(parseFilterInput("count:!=0")).toEqual([
      { type: "field", key: "count", operator: "neq", value: 0 },
    ]);
  });

  test("parses id filter", () => {
    expect(parseFilterInput("id:abc-123")).toEqual([
      { type: "id", value: "abc-123" },
    ]);
  });

  test("parses numeric id filter", () => {
    expect(parseFilterInput("id:456")).toEqual([
      { type: "id", value: "456" },
    ]);
  });

  test("parses multiple filters", () => {
    expect(parseFilterInput("status:active count:>10")).toEqual([
      { type: "field", key: "status", operator: "eq", value: "active" },
      { type: "field", key: "count", operator: "gt", value: 10 },
    ]);
  });

  test("ignores tokens without colon", () => {
    expect(parseFilterInput("invalid status:active")).toEqual([
      { type: "field", key: "status", operator: "eq", value: "active" },
    ]);
  });

  test("ignores empty key", () => {
    expect(parseFilterInput(":value")).toEqual([]);
  });

  test("ignores empty value", () => {
    expect(parseFilterInput("key:")).toEqual([]);
  });

  test("returns empty for blank input", () => {
    expect(parseFilterInput("")).toEqual([]);
    expect(parseFilterInput("   ")).toEqual([]);
  });

  test("treats operator prefix without valid number as string match", () => {
    expect(parseFilterInput("name:>abc")).toEqual([
      { type: "field", key: "name", operator: "eq", value: ">abc" },
    ]);
  });

  test("handles negative numbers", () => {
    expect(parseFilterInput("temp:>-5")).toEqual([
      { type: "field", key: "temp", operator: "gt", value: -5 },
    ]);
  });

  test("handles float values in exact match", () => {
    expect(parseFilterInput("score:0.95")).toEqual([
      { type: "field", key: "score", operator: "eq", value: 0.95 },
    ]);
  });

  test("parses double-quoted value with spaces", () => {
    expect(parseFilterInput('name:"Gjon Mili"')).toEqual([
      { type: "field", key: "name", operator: "eq", value: "Gjon Mili" },
    ]);
  });

  test("parses single-quoted value with spaces", () => {
    expect(parseFilterInput("name:'Gjon Mili'")).toEqual([
      { type: "field", key: "name", operator: "eq", value: "Gjon Mili" },
    ]);
  });

  test("parses quoted value alongside unquoted filters", () => {
    expect(parseFilterInput('id:17 name:"Gjon Mili" count:>5')).toEqual([
      { type: "id", value: "17" },
      { type: "field", key: "name", operator: "eq", value: "Gjon Mili" },
      { type: "field", key: "count", operator: "gt", value: 5 },
    ]);
  });

  test("parses quoted id value", () => {
    expect(parseFilterInput('id:"abc 123"')).toEqual([
      { type: "id", value: "abc 123" },
    ]);
  });
});

describe("formatFilterSummary", () => {
  test("formats field filters", () => {
    const conditions: FilterCondition[] = [
      { type: "field", key: "status", operator: "eq", value: "active" },
      { type: "field", key: "count", operator: "gt", value: 10 },
    ];
    expect(formatFilterSummary(conditions)).toBe("status:active count:>10");
  });

  test("formats id filter", () => {
    const conditions: FilterCondition[] = [
      { type: "id", value: "abc-123" },
    ];
    expect(formatFilterSummary(conditions)).toBe("id:abc-123");
  });

  test("formats all operators", () => {
    const conditions: FilterCondition[] = [
      { type: "field", key: "a", operator: "eq", value: 1 },
      { type: "field", key: "b", operator: "neq", value: 2 },
      { type: "field", key: "c", operator: "gt", value: 3 },
      { type: "field", key: "d", operator: "gte", value: 4 },
      { type: "field", key: "e", operator: "lt", value: 5 },
      { type: "field", key: "f", operator: "lte", value: 6 },
    ];
    expect(formatFilterSummary(conditions)).toBe("a:1 b:!=2 c:>3 d:>=4 e:<5 f:<=6");
  });

  test("quotes values containing spaces", () => {
    const conditions: FilterCondition[] = [
      { type: "field", key: "name", operator: "eq", value: "Gjon Mili" },
    ];
    expect(formatFilterSummary(conditions)).toBe('name:"Gjon Mili"');
  });
});
