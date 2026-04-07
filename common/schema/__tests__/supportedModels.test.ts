import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL, SUPPORTED_MODELS, supportedModel } from "../index";

describe("SUPPORTED_MODELS", () => {
  it("is a non-empty array", () => {
    expect(SUPPORTED_MODELS.length).toBeGreaterThan(0);
  });

  it("contains gpt-4o", () => {
    expect(SUPPORTED_MODELS).toContain("gpt-4o");
  });

  it("contains gpt-4o-mini", () => {
    expect(SUPPORTED_MODELS).toContain("gpt-4o-mini");
  });
});

describe("DEFAULT_MODEL", () => {
  it("is included in SUPPORTED_MODELS", () => {
    expect(SUPPORTED_MODELS).toContain(DEFAULT_MODEL);
  });

  it("equals gpt-4o-mini", () => {
    expect(DEFAULT_MODEL).toBe("gpt-4o-mini");
  });
});

describe("supportedModel", () => {
  it("parses gpt-4o successfully", () => {
    const result = supportedModel.safeParse("gpt-4o");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("gpt-4o");
    }
  });

  it("parses gpt-4o-mini successfully", () => {
    const result = supportedModel.safeParse("gpt-4o-mini");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("gpt-4o-mini");
    }
  });

  it("fails to parse an unknown model", () => {
    const result = supportedModel.safeParse("unknown-model");
    expect(result.success).toBe(false);
  });

  it("fails to parse an empty string", () => {
    const result = supportedModel.safeParse("");
    expect(result.success).toBe(false);
  });

  it("fails to parse a near-miss model name", () => {
    const result = supportedModel.safeParse("gpt-4o-turbo");
    expect(result.success).toBe(false);
  });
});
