import cors from "cors";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { validateEnv } from "../types/context";
import { createCorsOptions, getAllowedOrigins } from "../utils/corsConfig";

describe("CORS Service Integration Tests", () => {
  const originalEnv = process.env;
  let expressApp: express.Application;

  beforeAll(() => {
    // Set up test environment
    process.env = {
      ...originalEnv,
      NODE_ENV: "development",
      OPENAI_API_KEY: "test-key",
      GCLOUD_STORAGE_BUCKET: "test-bucket",
      GOOGLE_CREDENTIALS_ENCODED: "test-google-creds",
      FIREBASE_CREDENTIALS_ENCODED: "test-firebase-creds",
      CLIENT_BASE_URL: "http://localhost:3000",
      REDIS_URL: "redis://localhost:6379",
      ALLOWED_ORIGINS: "http://localhost:3000",
      ALLOWED_GCS_BUCKETS: "test-bucket,another-bucket",
      NODE_WORKER_TOPIC_NAME: "test-node-worker-topic",
      NODE_WORKER_SUBSCRIPTION_NAME: "test-node-worker-subscription",
    };

    // Create Express app with CORS - simulating real server setup
    expressApp = express();
    const env = validateEnv();
    const corsConfig = getAllowedOrigins(env);
    const corsOptions = createCorsOptions(corsConfig.origins);

    expressApp.use(cors(corsOptions));

    expressApp.post("/call-python-service", (_req, res) => {
      res.json({
        status: "python_service_called",
        expressOrigin: "http://localhost:8080",
        corsConfigured: true,
      });
    });

    // Health check endpoint
    expressApp.get("/health", (_req, res) => {
      res.json({ status: "ok", service: "express" });
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("Express Server CORS Configuration", () => {
    it("should allow Next.js client (localhost:3000) to access Express server", async () => {
      const response = await request(expressApp)
        .get("/health")
        .set("Origin", "http://localhost:3000")
        .expect(200);

      expect(response.headers["access-control-allow-origin"]).toBe(
        "http://localhost:3000",
      );
      expect(response.body.status).toBe("ok");
    });

    it("should allow Express server to make requests without origin header", async () => {
      // Server-to-server communication typically doesn't include Origin header
      const response = await request(expressApp)
        .post("/call-python-service")
        .send({ testData: "express-to-python" })
        .expect(200);

      expect(response.body.status).toBe("python_service_called");
      expect(response.body.expressOrigin).toBe("http://localhost:8080");
    });
  });

  describe("Production Service Communication", () => {
    it("should handle production CORS configuration correctly", () => {
      // Simulate production environment
      process.env.NODE_ENV = "production";
      process.env.ALLOWED_ORIGINS =
        "https://app.example.com,https://api.example.com";

      const env = validateEnv();
      const config = getAllowedOrigins(env);

      expect(config.environment).toBe("production");
      expect(config.origins).toEqual([
        "https://app.example.com",
        "https://api.example.com",
      ]);

      // Production should NOT include development origins
      expect(config.origins).not.toContain("http://localhost:3000");
      expect(config.origins).not.toContain("http://localhost:8080");

      // Reset for other tests
      process.env.NODE_ENV = "development";
    });

    it("should require ALLOWED_ORIGINS in all environments", () => {
      process.env.NODE_ENV = "development";
      delete process.env.ALLOWED_ORIGINS;

      expect(() => validateEnv()).toThrow(
        "ALLOWED_ORIGINS is required in all environments",
      );

      // Reset for other tests
      process.env.NODE_ENV = "development";
      process.env.ALLOWED_ORIGINS = "http://localhost:3000";
    });
  });

  describe("Security Regression Tests", () => {
    it("should block unauthorized origins from calling service endpoints", async () => {
      const maliciousOrigins = [
        "https://evil.com",
        "http://attacker.localhost",
        "https://phishing.example.com",
        "https://malicious-service.com",
      ];

      for (const origin of maliciousOrigins) {
        await request(expressApp)
          .post("/call-python-service")
          .set("Origin", origin)
          .set("Content-Type", "application/json")
          .send({ maliciousData: "attempted_attack" })
          .expect(500);
      }
    });

    it("should maintain allowlist-only approach for service communication", async () => {
      const unauthorizedOrigins = [
        "https://github.com",
        "https://google.com",
        "https://random-service.com",
        "http://localhost:8081", // Wrong port
        "https://localhost:3000", // Wrong protocol
      ];

      for (const origin of unauthorizedOrigins) {
        await request(expressApp)
          .get("/health")
          .set("Origin", origin)
          .expect(500);
      }
    });

    it("should reject wildcard origins", async () => {
      await request(expressApp).get("/health").set("Origin", "*").expect(500);
    });
  });

  describe("Environment Variable Consistency", () => {
    it("should parse ALLOWED_ORIGINS consistently", () => {
      const testOrigins = "  https://app1.com  ,  https://app2.com  ,  ";

      // Express parsing (via Zod)
      process.env.ALLOWED_ORIGINS = testOrigins;
      const env = validateEnv();
      const expressConfig = getAllowedOrigins(env);

      // Verify Express parsing is clean (no longer includes localhost:3000 by default)
      expect(expressConfig.origins).toContain("https://app1.com");
      expect(expressConfig.origins).toContain("https://app2.com");
      expect(
        expressConfig.origins.every((origin) => origin.trim() === origin),
      ).toBe(true);

      // Verify no empty strings in parsed origins
      expect(expressConfig.origins.every((origin) => origin.length > 0)).toBe(
        true,
      );
    });
  });
});
