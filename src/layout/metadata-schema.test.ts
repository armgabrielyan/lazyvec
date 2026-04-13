import { describe, expect, test } from "bun:test";
import type { VectorRecord } from "../adapters/types";
import { inferTableSchema } from "./metadata-schema";

function record(metadata: Record<string, unknown>): VectorRecord {
  return { id: "1", metadata, vector: null };
}

describe("metadata schema sampling", () => {
  test("returns empty columns for empty records", () => {
    const schema = inferTableSchema([]);
    expect(schema.columns).toEqual([]);
  });

  test("discovers string fields from records", () => {
    const records = [
      record({ name: "Alice", category: "A" }),
      record({ name: "Bob", category: "B" }),
    ];
    const schema = inferTableSchema(records);
    const names = schema.columns.map((c) => c.name);
    expect(names).toContain("name");
    expect(names).toContain("category");
  });

  test("discovers number fields from records", () => {
    const records = [
      record({ score: 0.95, count: 10 }),
      record({ score: 0.80, count: 20 }),
    ];
    const schema = inferTableSchema(records);
    const names = schema.columns.map((c) => c.name);
    expect(names).toContain("score");
    expect(names).toContain("count");
  });

  test("discovers boolean fields from records", () => {
    const records = [
      record({ active: true }),
      record({ active: false }),
    ];
    const schema = inferTableSchema(records);
    const names = schema.columns.map((c) => c.name);
    expect(names).toContain("active");
  });

  test("excludes object and array fields", () => {
    const records = [
      record({ name: "Alice", tags: ["a", "b"], nested: { x: 1 } }),
      record({ name: "Bob", tags: ["c"], nested: { x: 2 } }),
    ];
    const schema = inferTableSchema(records);
    const names = schema.columns.map((c) => c.name);
    expect(names).not.toContain("tags");
    expect(names).not.toContain("nested");
  });

  test("excludes noisy fields like image_url, embedding, vector", () => {
    const records = [
      record({ name: "Alice", image_url: "https://example.com/img.png", embedding: [0.1, 0.2] }),
      record({ name: "Bob", image_url: "https://example.com/img2.png", embedding: [0.3, 0.4] }),
    ];
    const schema = inferTableSchema(records);
    const names = schema.columns.map((c) => c.name);
    expect(names).not.toContain("image_url");
    expect(names).not.toContain("embedding");
  });

  test("excludes long text fields (content, body, text)", () => {
    const records = [
      record({ title: "Article", body: "A very long article body text that goes on and on..." }),
      record({ title: "Post", body: "Another long body of text for this post..." }),
    ];
    const schema = inferTableSchema(records);
    const names = schema.columns.map((c) => c.name);
    expect(names).not.toContain("body");
    expect(names).toContain("title");
  });

  test("ranks fields with higher non-null rate higher", () => {
    const records = [
      record({ name: "Alice", rare: "x" }),
      record({ name: "Bob" }),
      record({ name: "Carol" }),
      record({ name: "Dave" }),
    ];
    const schema = inferTableSchema(records);
    const nameIdx = schema.columns.findIndex((c) => c.name === "name");
    const rareIdx = schema.columns.findIndex((c) => c.name === "rare");
    expect(nameIdx).toBeLessThan(rareIdx);
  });

  test("tracks non-null rate accurately", () => {
    const records = [
      record({ name: "Alice", optional: "yes" }),
      record({ name: "Bob" }),
      record({ name: "Carol", optional: "no" }),
      record({ name: "Dave" }),
    ];
    const schema = inferTableSchema(records);
    const nameCol = schema.columns.find((c) => c.name === "name");
    const optCol = schema.columns.find((c) => c.name === "optional");
    expect(nameCol?.nonNullRate).toBe(1.0);
    expect(optCol?.nonNullRate).toBe(0.5);
  });

  test("handles records with completely different fields", () => {
    const records = [
      record({ name: "Alice", age: 30 }),
      record({ title: "Doc", category: "tech" }),
    ];
    const schema = inferTableSchema(records);
    const names = schema.columns.map((c) => c.name);
    expect(names.length).toBeGreaterThanOrEqual(2);
  });

  test("limits number of columns to a reasonable maximum", () => {
    const manyFields: Record<string, unknown> = {};
    for (let i = 0; i < 30; i++) {
      manyFields[`field_${i}`] = `value_${i}`;
    }
    const records = [record(manyFields), record(manyFields)];
    const schema = inferTableSchema(records);
    expect(schema.columns.length).toBeLessThanOrEqual(8);
  });

  test("prefers short-valued string fields over long URLs", () => {
    const records = [
      record({
        category: "sports",
        source_url: "https://example.com/very/long/path/to/some/resource?query=param&other=stuff",
      }),
      record({
        category: "tech",
        source_url: "https://example.com/another/very/long/path/to/some/other/resource",
      }),
    ];
    const schema = inferTableSchema(records);
    const catIdx = schema.columns.findIndex((c) => c.name === "category");
    const urlIdx = schema.columns.findIndex((c) => c.name === "source_url");
    expect(catIdx).toBeLessThan(urlIdx);
  });

  test("returns field type as the dominant type seen", () => {
    const records = [
      record({ score: 0.95 }),
      record({ score: 0.80 }),
      record({ score: 0.70 }),
    ];
    const schema = inferTableSchema(records);
    const scoreCol = schema.columns.find((c) => c.name === "score");
    expect(scoreCol?.type).toBe("number");
  });

  test("handles single record", () => {
    const records = [record({ name: "Alice", status: "active" })];
    const schema = inferTableSchema(records);
    expect(schema.columns.length).toBeGreaterThan(0);
  });
});
