import type { CollectionDataset } from "./types";

export const mockCollections: CollectionDataset[] = [
  {
    name: "rag_chunks",
    dimensions: 1536,
    count: 1240,
    metric: "cosine",
    status: "ready",
    records: [
      {
        id: "doc-a8f3c2",
        dimensions: 1536,
        metadata: {
          source: "wiki",
          title: "Quantum computing basics",
          chunk_index: 3,
          created_at: "2026-01-18T10:24:00Z",
        },
        vector: [0.0234, -0.0891, 0.1247, 0.0088, -0.0312, 0.0449, -0.1021, 0.0713],
      },
      {
        id: "doc-b1e9d7",
        dimensions: 1536,
        metadata: {
          source: "pdf",
          title: "Incident response runbook",
          chunk_index: 12,
          created_at: "2026-02-04T15:10:21Z",
        },
        vector: [0.1141, 0.0198, -0.052, 0.0763, 0.0912, -0.0033, -0.0415, 0.0219],
      },
      {
        id: "doc-c4f2a1",
        dimensions: 1536,
        metadata: {
          source: "web",
          title: "Qdrant filtering guide",
          chunk_index: 1,
          created_at: "2026-02-12T09:02:47Z",
        },
        vector: [-0.0184, 0.0621, 0.0348, -0.119, 0.0544, 0.0287, 0.0123, -0.0671],
      },
      {
        id: "doc-d7b3e8",
        dimensions: 1536,
        metadata: {
          source: "wiki",
          title: "Embedding drift notes",
          chunk_index: 7,
          created_at: "2026-03-01T18:44:10Z",
        },
        vector: [0.0711, -0.0221, 0.0182, 0.1014, -0.0443, -0.0527, 0.0328, 0.0064],
      },
    ],
  },
  {
    name: "products",
    dimensions: 768,
    count: 890,
    metric: "dotproduct",
    status: "ready",
    records: [
      {
        id: "sku-1017",
        dimensions: 768,
        metadata: {
          source: "catalog",
          title: "Noise cancelling headphones",
          category: "audio",
          updated_at: "2026-03-16T07:13:59Z",
        },
        vector: [0.012, 0.082, -0.045, 0.066, -0.019, 0.004, 0.037, -0.091],
      },
      {
        id: "sku-2044",
        dimensions: 768,
        metadata: {
          source: "catalog",
          title: "Ergonomic keyboard",
          category: "accessories",
          updated_at: "2026-03-18T11:40:11Z",
        },
        vector: [-0.077, 0.031, 0.015, 0.044, 0.089, -0.026, 0.012, -0.003],
      },
    ],
  },
  {
    name: "query_cache",
    dimensions: 1536,
    count: 340,
    metric: "cosine",
    status: "ready",
    records: [
      {
        id: "query-9931",
        dimensions: 1536,
        metadata: {
          source: "chat",
          intent: "debug",
          user_segment: "internal",
          cached_at: "2026-04-02T21:19:03Z",
        },
        vector: [0.041, -0.012, -0.038, 0.094, -0.018, 0.023, 0.065, -0.055],
      },
      {
        id: "query-9932",
        dimensions: 1536,
        metadata: {
          source: "chat",
          intent: "browse",
          user_segment: "internal",
          cached_at: "2026-04-02T21:22:44Z",
        },
        vector: [0.028, 0.052, -0.071, 0.003, 0.014, -0.086, 0.035, 0.049],
      },
    ],
  },
];
