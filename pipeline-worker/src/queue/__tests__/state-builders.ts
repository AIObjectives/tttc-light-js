import type { RedisPipelineStateStore } from "../../pipeline-runner/state-store.js";
import type {
  PipelineState,
  PipelineStepName,
} from "../../pipeline-runner/types.js";
import {
  MOCK_CLAIM,
  MOCK_SORT_DEDUPE_DATA,
  TEST_DATES,
  TEST_IDS,
  TEST_STRINGS,
} from "./fixtures.js";

// Base state builder - minimal fields
export const createBaseState = (
  overrides: Partial<Awaited<ReturnType<RedisPipelineStateStore["get"]>>> = {},
): Awaited<ReturnType<RedisPipelineStateStore["get"]>> => ({
  version: "1.0",
  reportId: TEST_IDS.report,
  userId: TEST_IDS.user,
  createdAt: new Date(TEST_DATES.base).toISOString(),
  updatedAt: new Date(TEST_DATES.summaries).toISOString(),
  status: "pending",
  stepAnalytics: {
    clustering: {
      stepName: "clustering",
      status: "pending",
      durationMs: 0,
      totalTokens: 0,
      cost: 0,
    },
    claims: {
      stepName: "claims",
      status: "pending",
      durationMs: 0,
      totalTokens: 0,
      cost: 0,
    },
    sort_and_deduplicate: {
      stepName: "sort_and_deduplicate",
      status: "pending",
      durationMs: 0,
      totalTokens: 0,
      cost: 0,
    },
    summaries: {
      stepName: "summaries",
      status: "pending",
      durationMs: 0,
      totalTokens: 0,
      cost: 0,
    },
    cruxes: {
      stepName: "cruxes",
      status: "pending",
      durationMs: 0,
      totalTokens: 0,
      cost: 0,
    },
  },
  completedResults: {},
  validationFailures: {
    clustering: 0,
    claims: 0,
    sort_and_deduplicate: 0,
    summaries: 0,
    cruxes: 0,
  },
  totalTokens: 0,
  totalCost: 0,
  totalDurationMs: 0,
  ...overrides,
});

// Step analytics builder
export const withCompletedSteps = (
  state: Awaited<ReturnType<RedisPipelineStateStore["get"]>>,
): Awaited<ReturnType<RedisPipelineStateStore["get"]>> => {
  if (!state) throw new Error("State is null");
  return {
    ...state,
    status: "completed",
    stepAnalytics: {
      clustering: {
        stepName: "clustering",
        status: "completed",
        startedAt: new Date(TEST_DATES.base).toISOString(),
        completedAt: new Date(TEST_DATES.clustering).toISOString(),
        durationMs: 900000,
        totalTokens: 150,
        cost: 0.001,
      },
      claims: {
        stepName: "claims",
        status: "completed",
        startedAt: new Date(TEST_DATES.clustering).toISOString(),
        completedAt: new Date(TEST_DATES.claims).toISOString(),
        durationMs: 900000,
        totalTokens: 300,
        cost: 0.002,
      },
      sort_and_deduplicate: {
        stepName: "sort_and_deduplicate",
        status: "completed",
        startedAt: new Date(TEST_DATES.claims).toISOString(),
        completedAt: new Date(TEST_DATES.sortDedup).toISOString(),
        durationMs: 900000,
        totalTokens: 200,
        cost: 0.0015,
      },
      summaries: {
        stepName: "summaries",
        status: "completed",
        startedAt: new Date(TEST_DATES.sortDedup).toISOString(),
        completedAt: new Date(TEST_DATES.summaries).toISOString(),
        durationMs: 900000,
        totalTokens: 250,
        cost: 0.0018,
      },
      cruxes: {
        stepName: "cruxes",
        status: "skipped",
      },
    },
    totalTokens: 900,
    totalCost: 0.0063,
    totalDurationMs: 3600000,
  };
};

// Completed results builder
export const withCompletedResults = (
  state: Awaited<ReturnType<RedisPipelineStateStore["get"]>>,
): Awaited<ReturnType<RedisPipelineStateStore["get"]>> => {
  if (!state) throw new Error("State is null");
  return {
    ...state,
    completedResults: {
      clustering: {
        data: [
          {
            topicName: TEST_STRINGS.topic,
            topicShortDescription: TEST_STRINGS.topicDesc,
            subtopics: [
              {
                subtopicName: TEST_STRINGS.subtopic,
                subtopicShortDescription: TEST_STRINGS.subtopicDesc,
              },
            ],
          },
        ],
        usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
        cost: 0.001,
      },
      claims: {
        data: {
          [TEST_STRINGS.topic]: {
            total: 1,
            subtopics: {
              [TEST_STRINGS.subtopic]: { total: 1, claims: [MOCK_CLAIM] },
            },
          },
        },
        usage: { input_tokens: 200, output_tokens: 100, total_tokens: 300 },
        cost: 0.002,
      },
      sort_and_deduplicate: {
        data: MOCK_SORT_DEDUPE_DATA,
        usage: { input_tokens: 150, output_tokens: 100, total_tokens: 250 },
        cost: 0.0018,
      },
      summaries: {
        data: [
          { topicName: TEST_STRINGS.topic, summary: TEST_STRINGS.summary },
        ],
        usage: { input_tokens: 150, output_tokens: 100, total_tokens: 250 },
        cost: 0.0018,
      },
    },
  };
};

// Convenience function for fully completed state
export const createCompletedState = (): Awaited<
  ReturnType<RedisPipelineStateStore["get"]>
> => withCompletedResults(withCompletedSteps(createBaseState()));

// Helper to create step analytics with completed status
export const createStepAnalytics = (options: {
  stepName: PipelineStepName;
  startTime: string;
  endTime: string;
  tokens: number;
  cost: number;
}) => ({
  stepName: options.stepName,
  status: "completed" as const,
  startedAt: options.startTime,
  completedAt: options.endTime,
  durationMs: 900000,
  totalTokens: options.tokens,
  cost: options.cost,
});

// Helper to create completed results for all pipeline steps
export const createCompletedResults = () => ({
  clustering: {
    data: [
      {
        topicName: TEST_STRINGS.topic,
        topicShortDescription: TEST_STRINGS.topicDesc,
        subtopics: [
          {
            subtopicName: TEST_STRINGS.subtopic,
            subtopicShortDescription: TEST_STRINGS.subtopicDesc,
          },
        ],
      },
    ],
    usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
    cost: 0.001,
  },
  claims: {
    data: {
      [TEST_STRINGS.topic]: {
        total: 1,
        subtopics: {
          [TEST_STRINGS.subtopic]: {
            total: 1,
            claims: [
              {
                claim: TEST_STRINGS.claim,
                quote: TEST_STRINGS.quote,
                speaker: TEST_STRINGS.speaker,
                topicName: TEST_STRINGS.topic,
                subtopicName: TEST_STRINGS.subtopic,
                commentId: TEST_IDS.comment,
              },
            ],
          },
        },
      },
    },
    usage: { input_tokens: 200, output_tokens: 100, total_tokens: 300 },
    cost: 0.002,
  },
  sort_and_deduplicate: {
    data: MOCK_SORT_DEDUPE_DATA,
    usage: { input_tokens: 150, output_tokens: 100, total_tokens: 250 },
    cost: 0.0018,
  },
  summaries: {
    data: [
      {
        topicName: TEST_STRINGS.topic,
        summary: TEST_STRINGS.summary,
      },
    ],
    usage: { input_tokens: 150, output_tokens: 100, total_tokens: 250 },
    cost: 0.0018,
  },
});

// Helper to create validation failures object
export const createValidationFailures = () => ({
  clustering: 0,
  claims: 0,
  sort_and_deduplicate: 0,
  summaries: 0,
  cruxes: 0,
});

// Create completed state with type-safe builder
export const createCompletedStateTyped = (): PipelineState => ({
  version: "1.0",
  reportId: TEST_IDS.report,
  userId: TEST_IDS.user,
  createdAt: new Date(TEST_DATES.base).toISOString(),
  updatedAt: new Date(TEST_DATES.summaries).toISOString(),
  status: "completed",
  stepAnalytics: {
    clustering: createStepAnalytics({
      stepName: "clustering",
      startTime: new Date(TEST_DATES.base).toISOString(),
      endTime: new Date(TEST_DATES.clustering).toISOString(),
      tokens: 150,
      cost: 0.001,
    }),
    claims: createStepAnalytics({
      stepName: "claims",
      startTime: new Date(TEST_DATES.clustering).toISOString(),
      endTime: new Date(TEST_DATES.claims).toISOString(),
      tokens: 300,
      cost: 0.002,
    }),
    sort_and_deduplicate: createStepAnalytics({
      stepName: "sort_and_deduplicate",
      startTime: new Date(TEST_DATES.claims).toISOString(),
      endTime: new Date(TEST_DATES.sortDedup).toISOString(),
      tokens: 200,
      cost: 0.0015,
    }),
    summaries: createStepAnalytics({
      stepName: "summaries",
      startTime: new Date(TEST_DATES.sortDedup).toISOString(),
      endTime: new Date(TEST_DATES.summaries).toISOString(),
      tokens: 250,
      cost: 0.0018,
    }),
    cruxes: {
      stepName: "cruxes",
      status: "skipped",
    },
  },
  completedResults: createCompletedResults(),
  validationFailures: createValidationFailures(),
  totalTokens: 900,
  totalCost: 0.0063,
  totalDurationMs: 3600000,
});

// Helper to create step analytics for running state tests
export const createRunningStepAnalytics = () => ({
  clustering: {
    stepName: "clustering" as const,
    status: "completed" as const,
    startedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
    completedAt: new Date("2026-01-01T00:15:00Z").toISOString(),
    durationMs: 900000,
    totalTokens: 150,
    cost: 0.001,
  },
  claims: {
    stepName: "claims" as const,
    status: "in_progress" as const,
    startedAt: new Date("2026-01-01T00:15:00Z").toISOString(),
    durationMs: 0,
    totalTokens: 0,
    cost: 0,
  },
  sort_and_deduplicate: {
    stepName: "sort_and_deduplicate" as const,
    status: "pending" as const,
    durationMs: 0,
    totalTokens: 0,
    cost: 0,
  },
  summaries: {
    stepName: "summaries" as const,
    status: "pending" as const,
    durationMs: 0,
    totalTokens: 0,
    cost: 0,
  },
  cruxes: {
    stepName: "cruxes" as const,
    status: "pending" as const,
    durationMs: 0,
    totalTokens: 0,
    cost: 0,
  },
});

// Helper to create completed clustering result
export const createClusteringResult = () => ({
  data: [
    {
      topicName: "Test Topic",
      topicShortDescription: "A test topic",
      subtopics: [
        {
          subtopicName: "Test Subtopic",
          subtopicShortDescription: "A test subtopic",
        },
      ],
    },
  ],
  usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
  cost: 0.001,
});

export const createRunningState = (updatedAt: string): PipelineState => ({
  version: "1.0",
  reportId: TEST_IDS.report,
  userId: TEST_IDS.user,
  createdAt: new Date(TEST_DATES.base).toISOString(),
  updatedAt,
  status: "running",
  currentStep: "claims",
  stepAnalytics: createRunningStepAnalytics(),
  completedResults: {
    clustering: createClusteringResult(),
  },
  validationFailures: {
    clustering: 0,
    claims: 0,
    sort_and_deduplicate: 0,
    summaries: 0,
    cruxes: 0,
  },
  totalTokens: 150,
  totalCost: 0.001,
  totalDurationMs: 900000,
});
