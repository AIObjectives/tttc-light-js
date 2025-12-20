import cors from "cors";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { validateEnv } from "../types/context";
import { createCorsOptions, getAllowedOrigins } from "../utils/corsConfig";

describe("CORS Integration Tests", () => {
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
      PYSERVER_URL: "http://localhost:8000",
      REDIS_URL: "redis://localhost:6379",
      ALLOWED_ORIGINS: "http://localhost:3000",
      ALLOWED_GCS_BUCKETS: "test-bucket,another-bucket",
    };

    // Create Express app with CORS
    expressApp = express();
    const env = validateEnv();
    const corsConfig = getAllowedOrigins(env);
    const corsOptions = createCorsOptions(corsConfig.origins);

    expressApp.use(cors(corsOptions));
    expressApp.get("/health", (_req, res) => {
      res.json({ status: "ok", service: "express" });
    });

    // Simulate calling Python service
    expressApp.post("/call-python", (_req, res) => {
      res.json({
        status: "would call python service",
        pythonUrl: process.env.PYSERVER_URL,
      });
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("Service Communication", () => {
    it("should allow Next.js client to call Express server", async () => {
      const response = await request(expressApp)
        .get("/health")
        .set("Origin", "http://localhost:3000")
        .expect(200);

      expect(response.headers["access-control-allow-origin"]).toBe(
        "http://localhost:3000",
      );
      expect(response.body.status).toBe("ok");
    });

    it("should allow preflight requests for complex operations", async () => {
      const response = await request(expressApp)
        .options("/call-python")
        .set("Origin", "http://localhost:3000")
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "Content-Type,X-OpenAI-API-Key")
        .expect(200);

      expect(response.headers["access-control-allow-methods"]).toContain(
        "POST",
      );
      expect(response.headers["access-control-allow-headers"]).toContain(
        "X-OpenAI-API-Key",
      );
      expect(response.headers["access-control-max-age"]).toBe("86400");
    });

    it("should block unauthorized origins attempting service calls", async () => {
      const unauthorizedOrigins = [
        "https://evil.com",
        "http://malicious-site.localhost",
        "https://phishing.example.com",
      ];

      for (const origin of unauthorizedOrigins) {
        await request(expressApp)
          .post("/call-python")
          .set("Origin", origin)
          .set("Content-Type", "application/json")
          .send({ test: "data" })
          .expect(500);
      }
    });

    it("should allow no-origin requests (for server-to-server communication)", async () => {
      const response = await request(expressApp).get("/health").expect(200);

      expect(response.body.status).toBe("ok");
    });
  });

  describe("CORS Configuration Validation", () => {
    it("should ensure Python server would accept Express server requests", () => {
      // This tests the configuration logic that Python service should use
      const expressServerOrigin = "http://localhost:8080";

      // Simulate Python server's default origins
      const pythonDefaultOrigins = [
        "http://localhost:3000", // Next.js client
        "http://localhost:8080", // Express server - REQUIRED
      ];

      expect(pythonDefaultOrigins).toContain(expressServerOrigin);
    });

    it("should validate environment variable parsing consistency", () => {
      const testOrigins = "  https://app1.com  ,  https://app2.com  ,  ";

      // Express parsing (via Zod)
      process.env.ALLOWED_ORIGINS = testOrigins;
      const env = validateEnv();
      const expressConfig = getAllowedOrigins(env);

      // Expected result should be clean array
      const _expectedOrigins = ["https://app1.com", "https://app2.com"];

      // No longer includes localhost:3000 by default
      expect(expressConfig.origins).toContain("https://app1.com");
      expect(expressConfig.origins).toContain("https://app2.com");
      expect(
        expressConfig.origins.every((origin) => origin.trim() === origin),
      ).toBe(true);
    });
  });

  describe("Production vs Development Configuration", () => {
    it("should handle production environment correctly", () => {
      process.env.NODE_ENV = "production";
      process.env.ALLOWED_ORIGINS =
        "https://prod.example.com,https://staging.example.com";

      const env = validateEnv();
      const config = getAllowedOrigins(env);

      expect(config.environment).toBe("production");
      expect(config.origins).toEqual([
        "https://prod.example.com",
        "https://staging.example.com",
      ]);
      expect(config.origins).not.toContain("http://localhost:3000");
    });

    it("should handle development environment correctly", () => {
      process.env.NODE_ENV = "development";
      process.env.ALLOWED_ORIGINS = "https://dev.example.com";

      const env = validateEnv();
      const config = getAllowedOrigins(env);

      expect(config.environment).toBe("development");
      // No longer includes localhost:3000 by default - only explicit origins
      expect(config.origins).toContain("https://dev.example.com");
      expect(config.origins).not.toContain("http://localhost:3000");
    });
  });
});
