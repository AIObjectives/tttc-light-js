/**
 * Tests for pipeline step utility functions
 */

import { describe, expect, it, vi } from "vitest";

// Mock the logger
vi.mock("tttc-common/logger", () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

// Mock weave
vi.mock("weave", () => ({
  init: vi.fn(),
  op: vi.fn((fn: unknown) => fn),
}));

import { tokenCost, UnknownModelError } from "../utils.js";

describe("tokenCost", () => {
  describe("OpenAI models", () => {
    it("should calculate cost for gpt-4o", () => {
      const result = tokenCost("gpt-4o", 1000, 500);
      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        // 1000 * 0.0025/1000 + 500 * 0.01/1000 = 0.0025 + 0.005 = 0.0075
        expect(result.value).toBeCloseTo(0.0075, 6);
      }
    });

    it("should calculate cost for gpt-4o-mini", () => {
      const result = tokenCost("gpt-4o-mini", 1000, 500);
      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        // 1000 * 0.00015/1000 + 500 * 0.0006/1000 = 0.00015 + 0.0003 = 0.00045
        expect(result.value).toBeCloseTo(0.00045, 6);
      }
    });

    it("gpt-4o should cost more than gpt-4o-mini for same tokens", () => {
      const gpt4oResult = tokenCost("gpt-4o", 1000, 1000);
      const gpt4oMiniResult = tokenCost("gpt-4o-mini", 1000, 1000);
      expect(gpt4oResult.tag).toBe("success");
      expect(gpt4oMiniResult.tag).toBe("success");
      if (gpt4oResult.tag === "success" && gpt4oMiniResult.tag === "success") {
        expect(gpt4oResult.value).toBeGreaterThan(gpt4oMiniResult.value);
      }
    });

    it("should return 0 cost when both token counts are 0", () => {
      const result = tokenCost("gpt-4o-mini", 0, 0);
      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        expect(result.value).toBe(0);
      }
    });
  });

  describe("Anthropic models", () => {
    it("should calculate cost for claude-opus-4-5", () => {
      const result = tokenCost("claude-opus-4-5", 1000, 500);
      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        // 1000 * 0.015/1000 + 500 * 0.075/1000 = 0.015 + 0.0375 = 0.0525
        expect(result.value).toBeCloseTo(0.0525, 6);
      }
    });

    it("should calculate cost for claude-sonnet-4-5", () => {
      const result = tokenCost("claude-sonnet-4-5", 1000, 500);
      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        // 1000 * 0.003/1000 + 500 * 0.015/1000 = 0.003 + 0.0075 = 0.0105
        expect(result.value).toBeCloseTo(0.0105, 6);
      }
    });

    it("should calculate cost for claude-haiku-4-5", () => {
      const result = tokenCost("claude-haiku-4-5", 1000, 500);
      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        // 1000 * 0.00025/1000 + 500 * 0.00125/1000 = 0.00025 + 0.000625 = 0.000875
        expect(result.value).toBeCloseTo(0.000875, 6);
      }
    });

    it("claude-opus-4-5 should cost more than claude-sonnet-4-5 for same tokens", () => {
      const opusResult = tokenCost("claude-opus-4-5", 1000, 1000);
      const sonnetResult = tokenCost("claude-sonnet-4-5", 1000, 1000);
      expect(opusResult.tag).toBe("success");
      expect(sonnetResult.tag).toBe("success");
      if (opusResult.tag === "success" && sonnetResult.tag === "success") {
        expect(opusResult.value).toBeGreaterThan(sonnetResult.value);
      }
    });

    it("claude-sonnet-4-5 should cost more than claude-haiku-4-5 for same tokens", () => {
      const sonnetResult = tokenCost("claude-sonnet-4-5", 1000, 1000);
      const haikuResult = tokenCost("claude-haiku-4-5", 1000, 1000);
      expect(sonnetResult.tag).toBe("success");
      expect(haikuResult.tag).toBe("success");
      if (sonnetResult.tag === "success" && haikuResult.tag === "success") {
        expect(sonnetResult.value).toBeGreaterThan(haikuResult.value);
      }
    });
  });

  describe("unknown models", () => {
    it("should return failure for unknown model", () => {
      const result = tokenCost("gpt-unknown", 1000, 500);
      expect(result.tag).toBe("failure");
      if (result.tag === "failure") {
        expect(result.error).toBeInstanceOf(UnknownModelError);
        expect(result.error.message).toContain("gpt-unknown");
      }
    });

    it("should return failure for empty string model", () => {
      const result = tokenCost("", 1000, 500);
      expect(result.tag).toBe("failure");
      if (result.tag === "failure") {
        expect(result.error).toBeInstanceOf(UnknownModelError);
      }
    });

    it("should return failure for partial model name", () => {
      const result = tokenCost("claude", 1000, 500);
      expect(result.tag).toBe("failure");
    });

    it("UnknownModelError should have correct name property", () => {
      const error = new UnknownModelError("test-model");
      expect(error.name).toBe("UnknownModelError");
      expect(error.message).toContain("test-model");
    });
  });

  describe("cost proportionality", () => {
    it("cost should scale linearly with input tokens", () => {
      const result1 = tokenCost("gpt-4o-mini", 1000, 0);
      const result2 = tokenCost("gpt-4o-mini", 2000, 0);
      expect(result1.tag).toBe("success");
      expect(result2.tag).toBe("success");
      if (result1.tag === "success" && result2.tag === "success") {
        expect(result2.value).toBeCloseTo(result1.value * 2, 6);
      }
    });

    it("cost should scale linearly with output tokens", () => {
      const result1 = tokenCost("gpt-4o-mini", 0, 1000);
      const result2 = tokenCost("gpt-4o-mini", 0, 2000);
      expect(result1.tag).toBe("success");
      expect(result2.tag).toBe("success");
      if (result1.tag === "success" && result2.tag === "success") {
        expect(result2.value).toBeCloseTo(result1.value * 2, 6);
      }
    });
  });
});
