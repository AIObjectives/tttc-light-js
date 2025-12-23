import { describe, expect, it } from "vitest";
import type { Env } from "../firebase-admin";
import {
  envSchema,
  getCollectionName,
  REPORT_REF_COLLECTION,
} from "../firebase-admin";

describe("firebase-admin shared utilities", () => {
  describe("REPORT_REF_COLLECTION", () => {
    it("should be 'reportRef'", () => {
      expect(REPORT_REF_COLLECTION).toBe("reportRef");
    });
  });

  describe("getCollectionName", () => {
    it("should return 'reportRef' for production environment", () => {
      const env: Env = {
        FIREBASE_CREDENTIALS_ENCODED: "encoded",
        GOOGLE_CREDENTIALS_ENCODED: "encoded",
        LEGACY_REPORT_USER_ID: "user123",
        NODE_ENV: "production",
      };
      expect(getCollectionName(env)).toBe("reportRef");
    });

    it("should return 'reportRef_dev' for development environment", () => {
      const env: Env = {
        FIREBASE_CREDENTIALS_ENCODED: "encoded",
        GOOGLE_CREDENTIALS_ENCODED: "encoded",
        LEGACY_REPORT_USER_ID: "user123",
        NODE_ENV: "development",
      };
      expect(getCollectionName(env)).toBe("reportRef_dev");
    });
  });

  describe("envSchema", () => {
    it("should validate a complete environment object", () => {
      const validEnv = {
        FIREBASE_CREDENTIALS_ENCODED: "base64encoded",
        GOOGLE_CREDENTIALS_ENCODED: "base64encoded",
        LEGACY_REPORT_USER_ID: "firebase-uid-123",
        NODE_ENV: "production",
      };

      const result = envSchema.safeParse(validEnv);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.NODE_ENV).toBe("production");
      }
    });

    it("should default NODE_ENV to development when not provided", () => {
      const envWithoutNodeEnv = {
        FIREBASE_CREDENTIALS_ENCODED: "base64encoded",
        GOOGLE_CREDENTIALS_ENCODED: "base64encoded",
        LEGACY_REPORT_USER_ID: "firebase-uid-123",
      };

      const result = envSchema.safeParse(envWithoutNodeEnv);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.NODE_ENV).toBe("development");
      }
    });

    it("should fail when FIREBASE_CREDENTIALS_ENCODED is missing", () => {
      const invalidEnv = {
        GOOGLE_CREDENTIALS_ENCODED: "base64encoded",
        LEGACY_REPORT_USER_ID: "firebase-uid-123",
      };

      const result = envSchema.safeParse(invalidEnv);
      expect(result.success).toBe(false);
    });

    it("should fail when GOOGLE_CREDENTIALS_ENCODED is missing", () => {
      const invalidEnv = {
        FIREBASE_CREDENTIALS_ENCODED: "base64encoded",
        LEGACY_REPORT_USER_ID: "firebase-uid-123",
      };

      const result = envSchema.safeParse(invalidEnv);
      expect(result.success).toBe(false);
    });

    it("should fail when LEGACY_REPORT_USER_ID is missing", () => {
      const invalidEnv = {
        FIREBASE_CREDENTIALS_ENCODED: "base64encoded",
        GOOGLE_CREDENTIALS_ENCODED: "base64encoded",
      };

      const result = envSchema.safeParse(invalidEnv);
      expect(result.success).toBe(false);
    });

    it("should fail when FIREBASE_CREDENTIALS_ENCODED is empty", () => {
      const invalidEnv = {
        FIREBASE_CREDENTIALS_ENCODED: "",
        GOOGLE_CREDENTIALS_ENCODED: "base64encoded",
        LEGACY_REPORT_USER_ID: "firebase-uid-123",
      };

      const result = envSchema.safeParse(invalidEnv);
      expect(result.success).toBe(false);
    });

    it("should fail for invalid NODE_ENV values", () => {
      const invalidEnv = {
        FIREBASE_CREDENTIALS_ENCODED: "base64encoded",
        GOOGLE_CREDENTIALS_ENCODED: "base64encoded",
        LEGACY_REPORT_USER_ID: "firebase-uid-123",
        NODE_ENV: "staging",
      };

      const result = envSchema.safeParse(invalidEnv);
      expect(result.success).toBe(false);
    });
  });
});
