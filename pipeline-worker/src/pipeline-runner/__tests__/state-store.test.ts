/**
 * Tests for Pipeline State Store
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Cache } from "../../cache/types.js";
import {
  canResumePipeline,
  createInitialState,
  createInitialStepAnalytics,
  getCompletedStepResults,
  getNextStep,
  markStepCompleted,
  markStepFailed,
  markStepSkipped,
  markStepStarted,
  RedisPipelineStateStore,
  updateStepAnalytics,
} from "../state-store.js";
import type { PipelineStepName } from "../types.js";
import { PipelineStateError } from "../types.js";

// Mock cache implementation
function createMockCache(): Cache & {
  storage: Map<string, string>;
  getTtl: (key: string) => number | undefined;
} {
  const storage = new Map<string, string>();
  const ttls = new Map<string, number>();

  return {
    storage,
    getTtl: (key: string) => ttls.get(key),
    async get(key: string): Promise<string | null> {
      return storage.get(key) ?? null;
    },
    async set(
      key: string,
      value: string,
      options?: { ttl?: number },
    ): Promise<void> {
      storage.set(key, value);
      if (options?.ttl) {
        ttls.set(key, options.ttl);
      }
    },
    async delete(key: string): Promise<void> {
      storage.delete(key);
      ttls.delete(key);
    },
    async acquireLock(
      key: string,
      value: string,
      _ttlSeconds: number,
    ): Promise<boolean> {
      if (storage.has(key)) return false;
      storage.set(key, value);
      return true;
    },
    async releaseLock(key: string, value: string): Promise<boolean> {
      const lockValue = storage.get(key);
      if (!lockValue || lockValue !== value) return false;
      storage.delete(key);
      return true;
    },
    async extendLock(
      key: string,
      value: string,
      ttlSeconds: number,
    ): Promise<boolean> {
      const lockValue = storage.get(key);
      if (!lockValue || lockValue !== value) return false;
      ttls.set(key, ttlSeconds);
      return true;
    },
    async increment(key: string, ttlSeconds?: number): Promise<number> {
      const currentValue = storage.get(key);
      const newValue = currentValue ? parseInt(currentValue, 10) + 1 : 1;
      storage.set(key, String(newValue));
      if (ttlSeconds) {
        ttls.set(key, ttlSeconds);
      }
      return newValue;
    },
    async setMultiple(
      operations: Array<{
        key: string;
        value: string;
        options?: { ttl?: number };
      }>,
      deleteKeys?: string[],
    ): Promise<void> {
      operations.forEach((op) => {
        storage.set(op.key, op.value);
        const ttl = op.options?.ttl;
        if (ttl !== undefined) {
          ttls.set(op.key, ttl);
        }
      });

      deleteKeys?.forEach((key) => {
        storage.delete(key);
        ttls.delete(key);
      });
    },
    async healthCheck(): Promise<void> {
      // Mock cache is always healthy
    },
  };
}

describe("Pipeline State Store", () => {
  describe("createInitialStepAnalytics", () => {
    it("should create analytics for all pipeline steps", () => {
      const analytics = createInitialStepAnalytics();

      const expectedSteps: PipelineStepName[] = [
        "clustering",
        "claims",
        "sort_and_deduplicate",
        "summaries",
        "cruxes",
      ];

      expect(Object.keys(analytics)).toHaveLength(5);

      for (const step of expectedSteps) {
        expect(analytics[step]).toBeDefined();
        expect(analytics[step].stepName).toBe(step);
        expect(analytics[step].status).toBe("pending");
      }
    });
  });

  describe("createInitialState", () => {
    it("should create valid initial state", () => {
      const state = createInitialState("report-123", "user-456");

      expect(state.version).toBe("1.0");
      expect(state.reportId).toBe("report-123");
      expect(state.userId).toBe("user-456");
      expect(state.status).toBe("pending");
      expect(state.totalTokens).toBe(0);
      expect(state.totalCost).toBe(0);
      expect(state.totalDurationMs).toBe(0);
      expect(state.completedResults).toEqual({});
      expect(state.createdAt).toBeDefined();
      expect(state.updatedAt).toBeDefined();
    });

    it("should have step analytics for all steps", () => {
      const state = createInitialState("report-123", "user-456");

      expect(state.stepAnalytics.clustering).toBeDefined();
      expect(state.stepAnalytics.claims).toBeDefined();
      expect(state.stepAnalytics.sort_and_deduplicate).toBeDefined();
      expect(state.stepAnalytics.summaries).toBeDefined();
      expect(state.stepAnalytics.cruxes).toBeDefined();
    });
  });

  describe("RedisPipelineStateStore", () => {
    let mockCache: ReturnType<typeof createMockCache>;
    let stateStore: RedisPipelineStateStore;

    beforeEach(() => {
      mockCache = createMockCache();
      stateStore = new RedisPipelineStateStore(mockCache);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    describe("save and get", () => {
      it("should save and retrieve state", async () => {
        const state = createInitialState("report-123", "user-456");

        await stateStore.save(state);
        const retrieved = await stateStore.get("report-123");

        expect(retrieved).toBeDefined();
        expect(retrieved?.reportId).toBe("report-123");
        expect(retrieved?.userId).toBe("user-456");
      });

      it("should return null for non-existent state", async () => {
        const retrieved = await stateStore.get("non-existent");

        expect(retrieved).toBeNull();
      });

      it("should use default TTL when not specified", async () => {
        const state = createInitialState("report-123", "user-456");

        await stateStore.save(state);

        const ttl = mockCache.getTtl("pipeline_state:report-123");
        expect(ttl).toBe(24 * 60 * 60); // 24 hours
      });

      it("should use custom TTL when specified", async () => {
        const state = createInitialState("report-123", "user-456");

        await stateStore.save(state, { ttl: 3600 });

        const ttl = mockCache.getTtl("pipeline_state:report-123");
        expect(ttl).toBe(3600);
      });

      it("should update timestamp on save", async () => {
        const state = createInitialState("report-123", "user-456");
        const originalUpdatedAt = state.updatedAt;

        // Wait a bit to ensure different timestamp
        await new Promise((resolve) => setTimeout(resolve, 10));

        await stateStore.save(state);
        const retrieved = await stateStore.get("report-123");

        expect(retrieved?.updatedAt).not.toBe(originalUpdatedAt);
      });
    });

    describe("delete", () => {
      it("should delete state", async () => {
        const state = createInitialState("report-123", "user-456");

        await stateStore.save(state);
        await stateStore.delete("report-123");

        const retrieved = await stateStore.get("report-123");
        expect(retrieved).toBeNull();
      });

      it("should not throw when deleting non-existent state", async () => {
        await expect(stateStore.delete("non-existent")).resolves.not.toThrow();
      });
    });

    describe("update", () => {
      it("should update specific fields", async () => {
        const state = createInitialState("report-123", "user-456");
        await stateStore.save(state);

        const updated = await stateStore.update("report-123", {
          status: "running",
          currentStep: "clustering",
        });

        expect(updated?.status).toBe("running");
        expect(updated?.currentStep).toBe("clustering");
      });

      it("should return null when updating non-existent state", async () => {
        const updated = await stateStore.update("non-existent", {
          status: "running",
        });

        expect(updated).toBeNull();
      });

      it("should preserve other fields when updating", async () => {
        const state = createInitialState("report-123", "user-456");
        state.totalTokens = 100;
        await stateStore.save(state);

        const updated = await stateStore.update("report-123", {
          status: "running",
        });

        expect(updated?.totalTokens).toBe(100);
      });
    });

    describe("validation", () => {
      it("should throw on invalid state format", async () => {
        mockCache.storage.set(
          "pipeline_state:report-123",
          JSON.stringify({ invalid: "data" }),
        );

        await expect(stateStore.get("report-123")).rejects.toThrow(
          PipelineStateError,
        );
      });

      it("should throw on invalid JSON", async () => {
        mockCache.storage.set("pipeline_state:report-123", "not valid json");

        await expect(stateStore.get("report-123")).rejects.toThrow(
          PipelineStateError,
        );
      });
    });

    describe("lock management", () => {
      it("should acquire lock successfully", async () => {
        const acquired = await stateStore.acquirePipelineLock(
          "report-123",
          "worker-1",
        );

        expect(acquired).toBe(true);
      });

      it("should prevent duplicate lock acquisition", async () => {
        await stateStore.acquirePipelineLock("report-123", "worker-1");

        const acquired = await stateStore.acquirePipelineLock(
          "report-123",
          "worker-2",
        );

        expect(acquired).toBe(false);
      });

      it("should release lock successfully", async () => {
        await stateStore.acquirePipelineLock("report-123", "worker-1");

        const released = await stateStore.releasePipelineLock(
          "report-123",
          "worker-1",
        );

        expect(released).toBe(true);
      });

      it("should fail to release lock with wrong value", async () => {
        await stateStore.acquirePipelineLock("report-123", "worker-1");

        const released = await stateStore.releasePipelineLock(
          "report-123",
          "worker-2",
        );

        expect(released).toBe(false);
      });

      it("should verify lock is held by correct value", async () => {
        await stateStore.acquirePipelineLock("report-123", "worker-1");

        const verified = await stateStore.verifyPipelineLock(
          "report-123",
          "worker-1",
        );

        expect(verified).toBe(true);
      });

      it("should fail verification with wrong value", async () => {
        await stateStore.acquirePipelineLock("report-123", "worker-1");

        const verified = await stateStore.verifyPipelineLock(
          "report-123",
          "worker-2",
        );

        expect(verified).toBe(false);
      });

      it("should fail verification when lock does not exist", async () => {
        const verified = await stateStore.verifyPipelineLock(
          "report-123",
          "worker-1",
        );

        expect(verified).toBe(false);
      });

      it("should allow re-acquiring lock after release", async () => {
        await stateStore.acquirePipelineLock("report-123", "worker-1");
        await stateStore.releasePipelineLock("report-123", "worker-1");

        const acquired = await stateStore.acquirePipelineLock(
          "report-123",
          "worker-2",
        );

        expect(acquired).toBe(true);
      });

      it("should extend lock TTL when held by correct value", async () => {
        await stateStore.acquirePipelineLock("report-123", "worker-1");

        const extended = await stateStore.extendPipelineLock(
          "report-123",
          "worker-1",
        );

        expect(extended).toBe(true);
      });

      it("should fail to extend lock with wrong value", async () => {
        await stateStore.acquirePipelineLock("report-123", "worker-1");

        const extended = await stateStore.extendPipelineLock(
          "report-123",
          "worker-2",
        );

        expect(extended).toBe(false);
      });

      it("should fail to extend lock when lock does not exist", async () => {
        const extended = await stateStore.extendPipelineLock(
          "report-123",
          "worker-1",
        );

        expect(extended).toBe(false);
      });

      it("should still hold lock after extension", async () => {
        await stateStore.acquirePipelineLock("report-123", "worker-1");
        await stateStore.extendPipelineLock("report-123", "worker-1");

        const verified = await stateStore.verifyPipelineLock(
          "report-123",
          "worker-1",
        );

        expect(verified).toBe(true);
      });
    });

    describe("validation failure counters", () => {
      it("should atomically save state with counter updates and zero counter deletions", async () => {
        const state = createInitialState("report-123", "user-456");
        state.validationFailures.clustering = 5;
        state.validationFailures.claims = 0;
        state.validationFailures.sort_and_deduplicate = 3;

        await stateStore.save(state);

        // Verify state was saved
        const retrieved = await stateStore.get("report-123");
        expect(retrieved).not.toBeNull();
        expect(retrieved?.validationFailures.clustering).toBe(5);
        expect(retrieved?.validationFailures.claims).toBe(0);

        // Verify non-zero counters were saved
        expect(
          mockCache.storage.get(
            "pipeline_validation_failure:report-123:clustering",
          ),
        ).toBe("5");
        expect(
          mockCache.storage.get(
            "pipeline_validation_failure:report-123:sort_and_deduplicate",
          ),
        ).toBe("3");

        // Verify zero counter key was deleted (not just set to "0")
        expect(
          mockCache.storage.has(
            "pipeline_validation_failure:report-123:claims",
          ),
        ).toBe(false);
      });

      it("should delete counter when decremented to zero", async () => {
        const state = createInitialState("report-123", "user-456");
        state.validationFailures.clustering = 5;

        await stateStore.save(state);

        // Verify counter exists
        expect(
          mockCache.storage.has(
            "pipeline_validation_failure:report-123:clustering",
          ),
        ).toBe(true);

        // Reset to zero
        state.validationFailures.clustering = 0;
        await stateStore.save(state);

        // Verify counter key was deleted
        expect(
          mockCache.storage.has(
            "pipeline_validation_failure:report-123:clustering",
          ),
        ).toBe(false);
      });

      it("should handle all counters being zero", async () => {
        const state = createInitialState("report-123", "user-456");
        // All validation failures default to 0

        await stateStore.save(state);

        // Verify state was saved
        const retrieved = await stateStore.get("report-123");
        expect(retrieved).not.toBeNull();

        // Verify no counter keys exist
        for (const step of [
          "clustering",
          "claims",
          "sort_and_deduplicate",
          "summaries",
          "cruxes",
        ]) {
          expect(
            mockCache.storage.has(
              `pipeline_validation_failure:report-123:${step}`,
            ),
          ).toBe(false);
        }
      });

      it("should handle all counters being non-zero", async () => {
        const state = createInitialState("report-123", "user-456");
        state.validationFailures.clustering = 1;
        state.validationFailures.claims = 2;
        state.validationFailures.sort_and_deduplicate = 3;
        state.validationFailures.summaries = 4;
        state.validationFailures.cruxes = 5;

        await stateStore.save(state);

        // Verify all counter keys exist with correct values
        expect(
          mockCache.storage.get(
            "pipeline_validation_failure:report-123:clustering",
          ),
        ).toBe("1");
        expect(
          mockCache.storage.get(
            "pipeline_validation_failure:report-123:claims",
          ),
        ).toBe("2");
        expect(
          mockCache.storage.get(
            "pipeline_validation_failure:report-123:sort_and_deduplicate",
          ),
        ).toBe("3");
        expect(
          mockCache.storage.get(
            "pipeline_validation_failure:report-123:summaries",
          ),
        ).toBe("4");
        expect(
          mockCache.storage.get(
            "pipeline_validation_failure:report-123:cruxes",
          ),
        ).toBe("5");
      });
    });
  });

  describe("updateStepAnalytics", () => {
    it("should update analytics for a specific step", () => {
      const state = createInitialState("report-123", "user-456");

      const updated = updateStepAnalytics(state, "clustering", {
        status: "in_progress",
        startedAt: "2024-01-01T00:00:00Z",
      });

      expect(updated.stepAnalytics.clustering.status).toBe("in_progress");
      expect(updated.stepAnalytics.clustering.startedAt).toBe(
        "2024-01-01T00:00:00Z",
      );
    });

    it("should not modify other steps", () => {
      const state = createInitialState("report-123", "user-456");

      const updated = updateStepAnalytics(state, "clustering", {
        status: "in_progress",
      });

      expect(updated.stepAnalytics.claims.status).toBe("pending");
      expect(updated.stepAnalytics.summaries.status).toBe("pending");
    });

    it("should update the updatedAt timestamp", () => {
      const state = createInitialState("report-123", "user-456");
      const originalUpdatedAt = state.updatedAt;

      // Wait to ensure different timestamp
      vi.useFakeTimers();
      vi.setSystemTime(new Date(Date.now() + 1000));

      const updated = updateStepAnalytics(state, "clustering", {
        status: "in_progress",
      });

      expect(updated.updatedAt).not.toBe(originalUpdatedAt);

      vi.useRealTimers();
    });
  });

  describe("markStepStarted", () => {
    it("should mark step as in_progress with startedAt", () => {
      const state = createInitialState("report-123", "user-456");

      const updated = markStepStarted(state, "clustering");

      expect(updated.stepAnalytics.clustering.status).toBe("in_progress");
      expect(updated.stepAnalytics.clustering.startedAt).toBeDefined();
    });
  });

  describe("markStepCompleted", () => {
    it("should mark step as completed with analytics", () => {
      const state = createInitialState("report-123", "user-456");

      const updated = markStepCompleted(state, "clustering", {
        durationMs: 1000,
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        cost: 0.01,
      });

      expect(updated.stepAnalytics.clustering.status).toBe("completed");
      expect(updated.stepAnalytics.clustering.completedAt).toBeDefined();
      expect(updated.stepAnalytics.clustering.durationMs).toBe(1000);
      expect(updated.stepAnalytics.clustering.inputTokens).toBe(100);
      expect(updated.stepAnalytics.clustering.outputTokens).toBe(50);
      expect(updated.stepAnalytics.clustering.totalTokens).toBe(150);
      expect(updated.stepAnalytics.clustering.cost).toBe(0.01);
    });

    it("should aggregate tokens and cost to state totals", () => {
      const state = createInitialState("report-123", "user-456");
      state.totalTokens = 50;
      state.totalCost = 0.005;

      const updated = markStepCompleted(state, "clustering", {
        durationMs: 1000,
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        cost: 0.01,
      });

      expect(updated.totalTokens).toBe(200); // 50 + 150
      expect(updated.totalCost).toBe(0.015); // 0.005 + 0.01
    });
  });

  describe("markStepFailed", () => {
    it("should mark step as failed with error info", () => {
      const state = createInitialState("report-123", "user-456");
      const error = new Error("Test error");
      error.name = "TestError";

      const updated = markStepFailed(state, "clustering", error, 500);

      expect(updated.stepAnalytics.clustering.status).toBe("failed");
      expect(updated.stepAnalytics.clustering.completedAt).toBeDefined();
      expect(updated.stepAnalytics.clustering.errorMessage).toBe("Test error");
      expect(updated.stepAnalytics.clustering.errorName).toBe("TestError");
      expect(updated.stepAnalytics.clustering.durationMs).toBe(500);
    });

    it("should set pipeline status to failed", () => {
      const state = createInitialState("report-123", "user-456");
      const error = new Error("Test error");

      const updated = markStepFailed(state, "clustering", error);

      expect(updated.status).toBe("failed");
    });

    it("should set pipeline error with step info", () => {
      const state = createInitialState("report-123", "user-456");
      const error = new Error("Test error");
      error.name = "TestError";

      const updated = markStepFailed(state, "clustering", error);

      expect(updated.error).toEqual({
        message: "Test error",
        name: "TestError",
        step: "clustering",
      });
    });
  });

  describe("markStepSkipped", () => {
    it("should mark step as skipped", () => {
      const state = createInitialState("report-123", "user-456");

      const updated = markStepSkipped(state, "cruxes");

      expect(updated.stepAnalytics.cruxes.status).toBe("skipped");
    });
  });

  describe("getNextStep", () => {
    it("should return first pending step", () => {
      const state = createInitialState("report-123", "user-456");

      const nextStep = getNextStep(state);

      expect(nextStep).toBe("clustering");
    });

    it("should skip completed steps", () => {
      const state = createInitialState("report-123", "user-456");
      state.stepAnalytics.clustering.status = "completed";

      const nextStep = getNextStep(state);

      expect(nextStep).toBe("claims");
    });

    it("should skip skipped steps", () => {
      const state = createInitialState("report-123", "user-456");
      state.stepAnalytics.clustering.status = "completed";
      state.stepAnalytics.claims.status = "completed";
      state.stepAnalytics.sort_and_deduplicate.status = "completed";
      state.stepAnalytics.summaries.status = "completed";
      state.stepAnalytics.cruxes.status = "skipped";

      const nextStep = getNextStep(state);

      expect(nextStep).toBeNull();
    });

    it("should return null when all steps completed", () => {
      const state = createInitialState("report-123", "user-456");

      for (const step of [
        "clustering",
        "claims",
        "sort_and_deduplicate",
        "summaries",
        "cruxes",
      ] as PipelineStepName[]) {
        state.stepAnalytics[step].status = "completed";
      }

      const nextStep = getNextStep(state);

      expect(nextStep).toBeNull();
    });

    it("should return failed step for retry", () => {
      const state = createInitialState("report-123", "user-456");
      state.stepAnalytics.clustering.status = "completed";
      state.stepAnalytics.claims.status = "failed";

      const nextStep = getNextStep(state);

      expect(nextStep).toBe("claims");
    });

    it("should return in_progress step (interrupted)", () => {
      const state = createInitialState("report-123", "user-456");
      state.stepAnalytics.clustering.status = "completed";
      state.stepAnalytics.claims.status = "in_progress";

      const nextStep = getNextStep(state);

      expect(nextStep).toBe("claims");
    });
  });

  describe("canResumePipeline", () => {
    it("should return true for failed pipeline", () => {
      const state = createInitialState("report-123", "user-456");
      state.status = "failed";

      expect(canResumePipeline(state)).toBe(true);
    });

    it("should return true for running pipeline", () => {
      const state = createInitialState("report-123", "user-456");
      state.status = "running";

      expect(canResumePipeline(state)).toBe(true);
    });

    it("should return false for completed pipeline", () => {
      const state = createInitialState("report-123", "user-456");
      state.status = "completed";

      expect(canResumePipeline(state)).toBe(false);
    });

    it("should return false for pending pipeline", () => {
      const state = createInitialState("report-123", "user-456");
      state.status = "pending";

      expect(canResumePipeline(state)).toBe(false);
    });
  });

  describe("getCompletedStepResults", () => {
    it("should return all false for initial state", () => {
      const state = createInitialState("report-123", "user-456");

      const results = getCompletedStepResults(state);

      expect(results).toEqual({
        hasClusteringResult: false,
        hasClaimsResult: false,
        hasSortedResult: false,
        hasSummariesResult: false,
        hasCruxesResult: false,
      });
    });

    it("should detect completed results", () => {
      const state = createInitialState("report-123", "user-456");
      state.completedResults.clustering = {
        data: [],
        usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
        cost: 0,
      };
      state.completedResults.claims = {
        data: {},
        usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
        cost: 0,
      };

      const results = getCompletedStepResults(state);

      expect(results.hasClusteringResult).toBe(true);
      expect(results.hasClaimsResult).toBe(true);
      expect(results.hasSortedResult).toBe(false);
      expect(results.hasSummariesResult).toBe(false);
      expect(results.hasCruxesResult).toBe(false);
    });
  });
});
