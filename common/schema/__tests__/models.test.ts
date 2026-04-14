/**
 * Tests for model definitions and helper functions
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_MODEL,
  getModelProvider,
  isAnthropicModel,
  isSupportedModel,
  SUPPORTED_ANTHROPIC_MODELS,
  SUPPORTED_MODELS,
  SUPPORTED_OPENAI_MODELS,
} from "../models.js";

describe("Model Definitions", () => {
  describe("SUPPORTED_OPENAI_MODELS", () => {
    it("should contain gpt-4o-mini", () => {
      expect(SUPPORTED_OPENAI_MODELS).toContain("gpt-4o-mini");
    });

    it("should be a readonly array", () => {
      expect(Array.isArray(SUPPORTED_OPENAI_MODELS)).toBe(true);
    });
  });

  describe("SUPPORTED_ANTHROPIC_MODELS", () => {
    it("should contain claude-sonnet-4-5", () => {
      expect(SUPPORTED_ANTHROPIC_MODELS).toContain("claude-sonnet-4-5");
    });

    it("should contain claude-opus-4-5", () => {
      expect(SUPPORTED_ANTHROPIC_MODELS).toContain("claude-opus-4-5");
    });

    it("should contain claude-haiku-4-5", () => {
      expect(SUPPORTED_ANTHROPIC_MODELS).toContain("claude-haiku-4-5");
    });
  });

  describe("SUPPORTED_MODELS", () => {
    it("should contain all OpenAI models", () => {
      for (const model of SUPPORTED_OPENAI_MODELS) {
        expect(SUPPORTED_MODELS).toContain(model);
      }
    });

    it("should contain all Anthropic models", () => {
      for (const model of SUPPORTED_ANTHROPIC_MODELS) {
        expect(SUPPORTED_MODELS).toContain(model);
      }
    });

    it("should have more models than either provider alone", () => {
      expect(SUPPORTED_MODELS.length).toBeGreaterThan(
        SUPPORTED_OPENAI_MODELS.length,
      );
      expect(SUPPORTED_MODELS.length).toBeGreaterThan(
        SUPPORTED_ANTHROPIC_MODELS.length,
      );
    });
  });

  describe("DEFAULT_MODEL", () => {
    it("should be gpt-4o-mini", () => {
      expect(DEFAULT_MODEL).toBe("gpt-4o-mini");
    });

    it("should be in SUPPORTED_MODELS", () => {
      expect(SUPPORTED_MODELS).toContain(DEFAULT_MODEL);
    });

    it("should be an OpenAI model", () => {
      expect(SUPPORTED_OPENAI_MODELS).toContain(DEFAULT_MODEL);
    });
  });
});

describe("getModelProvider", () => {
  it("should return openai for gpt-4o-mini", () => {
    expect(getModelProvider("gpt-4o-mini")).toBe("openai");
  });

  it("should return anthropic for claude-sonnet-4-5", () => {
    expect(getModelProvider("claude-sonnet-4-5")).toBe("anthropic");
  });

  it("should return anthropic for claude-opus-4-5", () => {
    expect(getModelProvider("claude-opus-4-5")).toBe("anthropic");
  });

  it("should return anthropic for claude-haiku-4-5", () => {
    expect(getModelProvider("claude-haiku-4-5")).toBe("anthropic");
  });

  it("should return openai for unknown model (default)", () => {
    // getModelProvider defaults to openai for any non-Anthropic model
    expect(getModelProvider("unknown-model")).toBe("openai");
  });

  it("should return openai for empty string (default)", () => {
    expect(getModelProvider("")).toBe("openai");
  });
});

describe("isAnthropicModel", () => {
  it("should return true for claude-sonnet-4-5", () => {
    expect(isAnthropicModel("claude-sonnet-4-5")).toBe(true);
  });

  it("should return true for claude-opus-4-5", () => {
    expect(isAnthropicModel("claude-opus-4-5")).toBe(true);
  });

  it("should return true for claude-haiku-4-5", () => {
    expect(isAnthropicModel("claude-haiku-4-5")).toBe(true);
  });

  it("should return false for gpt-4o-mini", () => {
    expect(isAnthropicModel("gpt-4o-mini")).toBe(false);
  });

  it("should return false for unknown model", () => {
    expect(isAnthropicModel("unknown-model")).toBe(false);
  });
});

describe("isSupportedModel", () => {
  it("should return true for gpt-4o-mini", () => {
    expect(isSupportedModel("gpt-4o-mini")).toBe(true);
  });

  it("should return true for claude-sonnet-4-5", () => {
    expect(isSupportedModel("claude-sonnet-4-5")).toBe(true);
  });

  it("should return true for claude-opus-4-5", () => {
    expect(isSupportedModel("claude-opus-4-5")).toBe(true);
  });

  it("should return true for claude-haiku-4-5", () => {
    expect(isSupportedModel("claude-haiku-4-5")).toBe(true);
  });

  it("should return false for unknown model", () => {
    expect(isSupportedModel("gpt-unknown")).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(isSupportedModel("")).toBe(false);
  });

  it("should return false for partial model name", () => {
    expect(isSupportedModel("gpt")).toBe(false);
    expect(isSupportedModel("claude")).toBe(false);
  });
});
