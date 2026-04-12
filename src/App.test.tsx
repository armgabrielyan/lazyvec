import { describe, expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { act } from "react";
import type { VectorDBAdapter } from "./adapters/types";
import { appReducer, createInitialState } from "./App";
import { App } from "./App";
import type { BrowserData } from "./app-data/browser-data";
import type { ConnectionProfile, ConnectionState } from "./types";

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

const localConnection: ConnectionProfile = {
  id: "local-qdrant",
  name: "local-qdrant",
  provider: "qdrant",
  url: "http://localhost:6333",
  description: "Local Qdrant",
  source: "config",
};

const connectionState: ConnectionState = {
  connections: [localConnection],
  defaultConnectionId: "local-qdrant",
  onboarding: {
    configPath: "~/.lazyvec/config.toml",
    missingConfig: false,
  },
};

const adapterCapabilities = {
  listCollections: true,
  describeCollection: true,
  listRecords: true,
  getRecord: true,
  includeVectorsInList: false,
  metadataFilter: false,
  namespaces: false,
  searchByVector: false,
  searchByText: false,
  deleteRecords: false,
};

function createFakeAdapter(): VectorDBAdapter {
  return {
    provider: "qdrant",
    capabilities: adapterCapabilities,
    async connect() {},
    async disconnect() {},
    async healthCheck() {
      return initialData.health;
    },
    async listCollections() {
      return initialData.collections;
    },
    async describeCollection(name) {
      const collection = initialData.collections.find((item) => item.name === name);

      if (collection === undefined) {
        throw new Error(`Unknown collection ${name}`);
      }

      return {
        ...collection,
        status: "ready",
        config: {},
      };
    },
    async listRecords() {
      return {
        records: [
          {
            id: "1",
            metadata: {
              name: "Chris Dyer",
              url: "/styles/chris-dyer",
            },
            vector: null,
          },
        ],
        nextCursor: "cursor-2",
      };
    },
    async getRecord() {
      return {
        id: "1",
        metadata: {
          name: "Chris Dyer",
          url: "/styles/chris-dyer",
        },
        vector: [0.1, 0.2],
      };
    },
  };
}

async function flushAsyncRender(renderOnce: () => Promise<void>) {
  for (let index = 0; index < 10; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    await renderOnce();
  }
}

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

describe("app reducer record inspection", () => {
  test("updates the record in the list with full metadata from inspection", () => {
    const connected = appReducer(createInitialState(1), {
      type: "CONNECT_SUCCESS",
      connectionName: "local-qdrant",
      data: {
        ...initialData,
        records: [
          { id: "1", metadata: { name: "Chris Dyer" }, vector: null },
          { id: "2", metadata: { name: "Catherine Hyde" }, vector: null },
        ],
      },
    });

    const inspected = appReducer(connected, {
      type: "INSPECT_RECORD_SUCCESS",
      record: {
        id: "1",
        metadata: { name: "Chris Dyer", url: "/styles/chris-dyer", tag: "art" },
        vector: [0.1, 0.2],
      },
    });

    expect(inspected.records[0]?.metadata).toEqual({
      name: "Chris Dyer",
      url: "/styles/chris-dyer",
      tag: "art",
    });
    expect(inspected.records[1]?.metadata).toEqual({ name: "Catherine Hyde" });
  });
});

describe("app reducer view copy", () => {
  test("leaves successful empty-record selection quiet because the records panel shows emptiness", () => {
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

    expect(next.status).toBe("");
  });

  test("keeps record movement quiet because the inspector updates with the selection", () => {
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

    expect(moved.status).toBe("");
    expect(loadingDetails.status).toBe("");
  });
});

describe("App OpenTUI render", () => {
  test("keeps idle connection picker chrome minimal", async () => {
    const testSetup = await testRender(
      <App
        connectionState={connectionState}
        createAdapter={async () => createFakeAdapter()}
      />,
      { width: 120, height: 36 },
    );

    await act(async () => {
      await testSetup.renderOnce();
    });

    const frame = testSetup.captureCharFrame();
    expect(frame).toContain("local-qdrant");
    expect(frame).not.toContain("│ lazyvec");
    expect(frame).not.toContain("choose connection");
    expect(frame).not.toContain("Pick a connection");
    expect(frame).not.toContain("Select a connection to start.");

    act(() => {
      testSetup.renderer.destroy();
    });
  });

  test("renders the main browser view after selecting a connection", async () => {
    const testSetup = await testRender(
      <App
        connectionState={connectionState}
        createAdapter={async () => createFakeAdapter()}
      />,
      { width: 120, height: 36 },
    );

    await act(async () => {
      await testSetup.renderOnce();
    });

    act(() => {
      testSetup.mockInput.pressEnter();
    });

    await flushAsyncRender(testSetup.renderOnce);

    const frame = testSetup.captureCharFrame();
    expect(frame).toContain("conn");
    expect(frame).toContain("local-qdrant");
    expect(frame).toContain("rag_chunks");
    expect(frame).toContain("Records");
    expect(frame).toContain("Chris Dyer");
    expect(frame).toContain("Payload:");
    expect(frame).toContain("press Enter to fetch vector");
    expect(frame).not.toContain("Connected to");
    expect(frame).not.toContain("main:");
    expect(frame).not.toContain("ready");

    act(() => {
      testSetup.renderer.destroy();
    });
  });
});
