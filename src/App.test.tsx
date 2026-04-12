import { describe, expect, test } from "bun:test";
import { appReducer, createInitialState } from "./App";
import type { BrowserData } from "./app-data/browser-data";

const initialData: BrowserData = {
  health: {
    connected: true,
    latencyMs: 4,
    provider: "qdrant",
  },
  collections: [
    {
      name: "rag_chunks",
      dimensions: 512,
      count: 100,
      metric: "cosine",
      provider: "qdrant",
    },
  ],
  records: [
    {
      id: "1",
      metadata: {},
      vector: null,
    },
  ],
  recordCursor: "cursor-2",
};

describe("app reducer record pagination", () => {
  test("appends next record page and selects the first appended record", () => {
    const connected = appReducer(createInitialState(1), {
      type: "CONNECT_SUCCESS",
      connectionName: "local-qdrant",
      data: initialData,
    });
    const loadingNext = appReducer(connected, {
      type: "LOAD_NEXT_RECORDS_REQUEST",
      collectionName: "rag_chunks",
    });

    const next = appReducer(loadingNext, {
      type: "LOAD_NEXT_RECORDS_SUCCESS",
      page: {
        records: [
          {
            id: "2",
            metadata: {},
            vector: null,
          },
        ],
        nextCursor: "cursor-3",
      },
    });

    expect(loadingNext.loading).toBe(true);
    expect(next.loading).toBe(false);
    expect(next.records.map((record) => record.id)).toEqual(["1", "2"]);
    expect(next.selectedRecordIndex).toBe(1);
    expect(next.recordCursor).toBe("cursor-3");
  });

  test("keeps records unchanged when there is no next page cursor", () => {
    const connected = appReducer(createInitialState(1), {
      type: "CONNECT_SUCCESS",
      connectionName: "local-qdrant",
      data: {
        ...initialData,
        recordCursor: undefined,
      },
    });
    const next = appReducer(connected, {
      type: "LOAD_NEXT_RECORDS_END",
    });

    expect(next.records).toEqual(connected.records);
    expect(next.recordCursor).toBeUndefined();
    expect(next.status).toBe("End of collection.");
  });
});

describe("app reducer view copy", () => {
  test("uses explicit empty-record copy after selecting an empty collection", () => {
    const connected = appReducer(createInitialState(1), {
      type: "CONNECT_SUCCESS",
      connectionName: "local-qdrant",
      data: initialData,
    });
    const next = appReducer(connected, {
      type: "SELECT_COLLECTION_SUCCESS",
      index: 0,
      collectionName: "rag_chunks",
      page: {
        records: [],
        nextCursor: undefined,
      },
    });

    expect(next.status).toBe("No records found in rag_chunks.");
  });

  test("describes Enter as fetching vector details after record movement", () => {
    const connected = appReducer(createInitialState(1), {
      type: "CONNECT_SUCCESS",
      connectionName: "local-qdrant",
      data: {
        ...initialData,
        records: [
          { id: "1", metadata: {}, vector: null },
          { id: "2", metadata: {}, vector: null },
        ],
      },
    });
    const moved = appReducer(connected, {
      type: "MOVE_RECORD",
      delta: 1,
      recordCount: 2,
    });
    const loadingDetails = appReducer(moved, {
      type: "INSPECT_RECORD_REQUEST",
      recordId: "2",
    });

    expect(moved.status).toBe("Selected record updated. Press Enter to fetch vector.");
    expect(loadingDetails.status).toBe("Fetching vector for 2...");
  });
});
