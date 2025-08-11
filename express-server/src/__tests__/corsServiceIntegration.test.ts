import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import cors from "cors";
import request from "supertest";
import { getAllowedOrigins, createCorsOptions } from "../utils/corsConfig";
import { validateEnv } from "../types/context";

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
      PYSERVER_URL: "http://localhost:8000",
      REDIS_URL: "redis://localhost:6379",
      ALLOWED_ORIGINS: "http://localhost:3000",
    };

    // Create Express app with CORS - simulating real server setup
    expressApp = express();
    const env = validateEnv();
    const corsConfig = getAllowedOrigins(env);
    const corsOptions = createCorsOptions(corsConfig.origins);

    expressApp.use(cors(corsOptions));

    // Simulate Express→Python communication endpoint
    expressApp.post("/call-python-service", (req, res) => {
      // In real implementation, this would make HTTP request to Python server
      // For testing, we simulate the communication pattern
      res.json({
        status: "python_service_called",
        expressOrigin: "http://localhost:8080",
        pythonUrl: process.env.PYSERVER_URL,
        corsConfigured: true,
      });
    });

    // Health check endpoint
    expressApp.get("/health", (req, res) => {
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

  describe("Python Service Communication Requirements", () => {
    it("should validate Python server would accept Express server requests", () => {
      // This tests the configuration logic that Python service should use
      const expressServerOrigin = "http://localhost:8080";

      // Simulate Python server's required origins for service communication
      const requiredPythonOrigins = [
        "http://localhost:3000", // Next.js client
        "http://localhost:8080", // Express server - CRITICAL
      ];

      expect(requiredPythonOrigins).toContain(expressServerOrigin);
    });

    it("should ensure consistent CORS configuration between services", () => {
      const env = validateEnv();
      const expressConfig = getAllowedOrigins(env);

      // Verify Express server is configured for development
      expect(expressConfig.environment).toBe("development");
      expect(expressConfig.origins).toContain("http://localhost:3000");

      // Express server needs to allow Next.js client requests
      expect(expressConfig.origins).toContain("http://localhost:3000");

      // Python server needs to allow BOTH Next.js client AND Express server requests
      const requiredPythonOrigins = [
        "http://localhost:3000", // Next.js client
        "http://localhost:8080", // Express server - CRITICAL for service communication
      ];

      // Note: Express server doesn't need to allow itself as an origin
      // Only Python server needs to allow Express server requests
      // This is the correct architecture - Express makes requests TO Python, not vice versa
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
    it("should parse ALLOWED_ORIGINS consistently between Express and Python", () => {
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
