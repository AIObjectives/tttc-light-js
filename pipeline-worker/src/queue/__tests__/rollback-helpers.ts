import type { vi } from "vitest";
import { TEST_STORAGE } from "./fixtures.js";

// Shared test helper for rollback behavior tests
export type MockStorage = {
  storeFile: ReturnType<typeof vi.fn>;
  deleteFile: ReturnType<typeof vi.fn>;
  fileExists: ReturnType<typeof vi.fn>;
};

export type MockRefStore = {
  Report: {
    get: ReturnType<typeof vi.fn>;
    modify: ReturnType<typeof vi.fn>;
  };
};

export type MockPipelineResult = {
  sortedTree: Array<
    [string, { topics: Array<never>; counts: { claims: number } }]
  >;
  completedAt: string;
};

export type MockData = {
  reportDetails: {
    title: string;
    description: string;
  };
  data: Array<{
    id: string;
    comment: string;
    interview?: string;
    video?: string;
    timestamp?: string;
  }>;
};

export type SavePipelineOptions = {
  result: MockPipelineResult;
  reportId: string;
  storage: MockStorage;
  refStore: MockRefStore;
};

export const saveSuccessfulPipeline = async ({
  result,
  reportId,
  storage,
  refStore,
}: SavePipelineOptions) => {
  const reportUrl = await storage.storeFile(
    TEST_STORAGE.filename(reportId),
    JSON.stringify(result),
  );

  try {
    const reportRef = await refStore.Report.get(reportId);
    await refStore.Report.modify(reportId, {
      ...reportRef,
      reportDataUri: reportUrl,
      status: "completed",
    });
  } catch (firestoreError) {
    try {
      await storage.deleteFile(TEST_STORAGE.filename(reportId));
    } catch (_deleteError) {
      // Log but don't throw - deletion failure shouldn't mask original error
    }
    throw firestoreError;
  }
};
