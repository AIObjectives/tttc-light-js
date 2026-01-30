import { vi } from "vitest";
import type { BucketStore } from "../../bucketstore/index.js";
import type { RefStoreServices } from "../../datastore/refstore/index.js";
import type { RedisPipelineStateStore } from "../../pipeline-runner/state-store.js";
import type { PubSubMessage } from "../index.js";

// Test constants
export const TEST_IDS = {
  report: "test-report-123",
  user: "test-user-123",
  message: "msg-123",
  request: "req-123",
  comment: "c1",
} as const;

export const TEST_DATES = {
  base: "2026-01-01T00:00:00Z",
  clustering: "2026-01-01T00:15:00Z",
  claims: "2026-01-01T00:30:00Z",
  sortDedup: "2026-01-01T00:45:00Z",
  summaries: "2026-01-01T01:00:00Z",
} as const;

export const TEST_STRINGS = {
  title: "Test Report",
  description: "Test Description",
  question: "Test Question",
  filename: "test.csv",
  topic: "Test Topic",
  topicDesc: "A test topic",
  subtopic: "Test Subtopic",
  subtopicDesc: "A test subtopic",
  claim: "Test claim",
  quote: "Test quote",
  summary: "Test summary",
  speaker: "Speaker1",
  comment: "Test comment",
  apiKey: "test-api-key",
  model: "gpt-4",
} as const;

export const TEST_INSTRUCTIONS = {
  system: "System instructions",
  clustering: "Clustering instructions",
  extraction: "Extraction instructions",
  dedup: "Dedup instructions",
  summaries: "Summaries instructions",
  crux: "Crux instructions",
} as const;

export const TEST_ERRORS = {
  firestoreConnection: "Firestore connection failed",
  firestoreUpdate: "Firestore update failed",
  deletePermission: "Delete permission denied",
  testError: "Test error",
} as const;

export const TEST_STORAGE = {
  bucket: "gs://bucket",
  filename: (id: string) => `${id}.json`,
  url: (id: string) => `gs://bucket/${id}.json`,
} as const;

// Test helpers
export const createComment = (
  id: string,
  text: string,
  speaker = "participant",
): { comment_id: string; comment_text: string; speaker: string } => ({
  comment_id: id,
  comment_text: text,
  speaker,
});

// Factory function to create test mocks
export const createTestMocks = () => ({
  stateStore: {
    get: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    acquirePipelineLock: vi.fn(),
    extendPipelineLock: vi.fn(),
    releasePipelineLock: vi.fn(),
    incrementValidationFailure: vi.fn(),
  } as unknown as RedisPipelineStateStore,

  storage: {
    storeFile: vi.fn(),
    fileExists: vi.fn(),
    deleteFile: vi.fn(),
  } as unknown as BucketStore,

  refStore: {
    Report: {
      get: vi.fn(),
      modify: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as RefStoreServices,
});

export const createMockMessage = (): PubSubMessage<{
  data: Array<{ comment_id: string; comment_text: string; speaker: string }>;
  config: {
    instructions: {
      systemInstructions: string;
      clusteringInstructions: string;
      extractionInstructions: string;
      dedupInstructions: string;
      summariesInstructions: string;
      cruxInstructions: string;
      outputLanguage?: string;
    };
    llm: { model: string; temperature: number; max_tokens: number };
    options: { cruxes: boolean; sortStrategy: "numPeople" | "numClaims" };
    env: { OPENAI_API_KEY: string };
    firebaseDetails: { reportId: string; userId: string };
  };
  reportDetails: {
    title: string;
    description: string;
    question: string;
    filename: string;
  };
}> => ({
  id: TEST_IDS.message,
  data: {
    data: [
      {
        comment_id: TEST_IDS.comment,
        comment_text: TEST_STRINGS.comment,
        speaker: TEST_STRINGS.speaker,
      },
    ],
    config: {
      instructions: {
        systemInstructions: TEST_INSTRUCTIONS.system,
        clusteringInstructions: TEST_INSTRUCTIONS.clustering,
        extractionInstructions: TEST_INSTRUCTIONS.extraction,
        dedupInstructions: TEST_INSTRUCTIONS.dedup,
        summariesInstructions: TEST_INSTRUCTIONS.summaries,
        cruxInstructions: TEST_INSTRUCTIONS.crux,
      },
      llm: { model: TEST_STRINGS.model, temperature: 0.7, max_tokens: 1000 },
      options: { cruxes: false, sortStrategy: "numPeople" },
      env: { OPENAI_API_KEY: TEST_STRINGS.apiKey },
      firebaseDetails: {
        reportId: TEST_IDS.report,
        userId: TEST_IDS.user,
      },
    },
    reportDetails: {
      title: TEST_STRINGS.title,
      description: TEST_STRINGS.description,
      question: TEST_STRINGS.question,
      filename: TEST_STRINGS.filename,
    },
  },
  attributes: { requestId: TEST_IDS.request },
  publishTime: new Date(),
});

// Mock data fixtures
export const MOCK_CLAIM = {
  claim: TEST_STRINGS.claim,
  quote: TEST_STRINGS.quote,
  speaker: TEST_STRINGS.speaker,
  topicName: TEST_STRINGS.topic,
  subtopicName: TEST_STRINGS.subtopic,
  commentId: TEST_IDS.comment,
};

export const MOCK_SORT_DEDUPE_DATA: [
  string,
  {
    topics: [
      string,
      {
        claims: Array<
          typeof MOCK_CLAIM & { duplicates: never[]; duplicated: boolean }
        >;
        speakers: string[];
        counts: { claims: number; speakers: number };
      },
    ][];
    speakers: string[];
    counts: { claims: number; speakers: number };
  },
][] = [
  [
    TEST_STRINGS.topic,
    {
      topics: [
        [
          TEST_STRINGS.subtopic,
          {
            claims: [{ ...MOCK_CLAIM, duplicates: [], duplicated: false }],
            speakers: [TEST_STRINGS.speaker],
            counts: { claims: 1, speakers: 1 },
          },
        ],
      ],
      speakers: [TEST_STRINGS.speaker],
      counts: { claims: 1, speakers: 1 },
    },
  ],
];

// Create mock report reference with defaults
export const createMockReportRef = (
  overrides: {
    status?: "processing" | "completed" | "failed";
    reportDataUri?: string;
    numTopics?: number;
    numSubtopics?: number;
    numClaims?: number;
    numPeople?: number;
    errorMessage?: string;
  } = {},
) => ({
  id: TEST_IDS.report,
  userId: TEST_IDS.user,
  reportDataUri: overrides.reportDataUri ?? "",
  title: TEST_STRINGS.title,
  description: TEST_STRINGS.description,
  numTopics: overrides.numTopics ?? 0,
  numSubtopics: overrides.numSubtopics ?? 0,
  numClaims: overrides.numClaims ?? 0,
  numPeople: overrides.numPeople ?? 0,
  status: overrides.status ?? "processing",
  createdDate: new Date(),
  lastStatusUpdate: new Date(),
  ...(overrides.errorMessage && { errorMessage: overrides.errorMessage }),
});
