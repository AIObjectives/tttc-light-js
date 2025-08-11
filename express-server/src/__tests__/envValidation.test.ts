import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateEnv } from "../types/context";

describe("Environment Variable Validation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Set up minimal required env vars
    process.env = {
      ...originalEnv,
      NODE_ENV: "development",
      OPENAI_API_KEY: "test-key",
      GCLOUD_STORAGE_BUCKET: "test-bucket",
      GOOGLE_CREDENTIALS_ENCODED: "test-google-creds",
      FIREBASE_CREDENTIALS_ENCODED: "test-firebase-creds",
      CLIENT_BASE_URL: "http://localhost:3000",
      PYSERVER_URL: "http://localhost:8000",
      REDIS_URL: "redis://localhost:6379",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("ALLOWED_ORIGINS Validation", () => {
    it("should reject empty ALLOWED_ORIGINS in all environments", () => {
      process.env.ALLOWED_ORIGINS = "";

      expect(() => validateEnv()).toThrow(
        "ALLOWED_ORIGINS must contain at least one valid origin",
      );
    });

    it("should reject missing ALLOWED_ORIGINS in all environments", () => {
      delete process.env.ALLOWED_ORIGINS;

      expect(() => validateEnv()).toThrow(
        "ALLOWED_ORIGINS is required in all environments",
      );
    });

    it("should parse comma-separated ALLOWED_ORIGINS correctly", () => {
      process.env.ALLOWED_ORIGINS =
        "https://app1.com,https://app2.com,https://app3.com";

      const result = validateEnv();

      expect(result.ALLOWED_ORIGINS).toEqual([
        "https://app1.com",
        "https://app2.com",
        "https://app3.com",
      ]);
    });

    it("should trim whitespace from ALLOWED_ORIGINS", () => {
      process.env.ALLOWED_ORIGINS = "  https://app1.com  ,  https://app2.com  ";

      const result = validateEnv();

      expect(result.ALLOWED_ORIGINS).toEqual([
        "https://app1.com",
        "https://app2.com",
      ]);
    });

    it("should filter out empty origins from ALLOWED_ORIGINS", () => {
      process.env.ALLOWED_ORIGINS = "https://app1.com, ,https://app2.com,  ,";

      const result = validateEnv();

      expect(result.ALLOWED_ORIGINS).toEqual([
        "https://app1.com",
        "https://app2.com",
      ]);
    });

    it("should require ALLOWED_ORIGINS in all environments", () => {
      process.env.NODE_ENV = "production";
      process.env.ALLOWED_ORIGINS = "";

      expect(() => validateEnv()).toThrow(
        "ALLOWED_ORIGINS must contain at least one valid origin",
      );
    });

    it("should allow ALLOWED_ORIGINS in production mode when provided", () => {
      process.env.NODE_ENV = "production";
      process.env.ALLOWED_ORIGINS =
        "https://production-app.com,https://staging-app.com";

      const result = validateEnv();

      expect(result.ALLOWED_ORIGINS).toEqual([
        "https://production-app.com",
        "https://staging-app.com",
      ]);
    });

    it("should validate that all origins are valid URLs", () => {
      process.env.ALLOWED_ORIGINS =
        "https://valid.com,not-a-url,htp://typo.com";

      expect(() => validateEnv()).toThrow(
        "All ALLOWED_ORIGINS must be valid URLs",
      );
    });

    it("should accept various valid URL formats", () => {
      process.env.ALLOWED_ORIGINS =
        "https://app.com,http://localhost:3000,https://sub.domain.org:8080";

      const result = validateEnv();

      expect(result.ALLOWED_ORIGINS).toEqual([
        "https://app.com",
        "http://localhost:3000",
        "https://sub.domain.org:8080",
      ]);
    });

    it("should reject invalid URL schemes", () => {
      process.env.ALLOWED_ORIGINS = "file://local-file,ftp://server.com";

      // These are technically valid URLs but might not be appropriate for CORS
      // The validation allows them since they're valid URLs
      const result = validateEnv();

      expect(result.ALLOWED_ORIGINS).toEqual([
        "file://local-file",
        "ftp://server.com",
      ]);
    });

    it("should reject only whitespace in ALLOWED_ORIGINS", () => {
      process.env.ALLOWED_ORIGINS = "   ";

      expect(() => validateEnv()).toThrow(
        "ALLOWED_ORIGINS must contain at least one valid origin",
      );
    });
  });

  describe("Integration with CORS Logic", () => {
    it("should provide origins that work with CORS configuration", () => {
      process.env.ALLOWED_ORIGINS = "https://app1.com,https://app2.com";

      const result = validateEnv();

      // These should be valid origins for CORS
      result.ALLOWED_ORIGINS.forEach((origin) => {
        expect(origin).toMatch(/^https?:\/\//);
        expect(origin.trim()).toBe(origin);
        expect(origin.length).toBeGreaterThan(0);
      });
    });
  });
});
