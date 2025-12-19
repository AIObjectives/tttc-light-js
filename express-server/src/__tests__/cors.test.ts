import cors from "cors";
import express from "express";
import helmet from "helmet";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Store original env
const originalEnv = process.env;

import { validateEnv } from "../types/context";
import { createCorsOptions, getAllowedOrigins } from "../utils/corsConfig";

// Create a test app with the same CORS configuration as server.ts
const createTestApp = (includeSecurityHeaders = false) => {
  const app = express();

  // Use the same CORS configuration as production
  // Create a minimal valid environment for testing
  const testEnv = validateEnv();
  const corsConfig = getAllowedOrigins(testEnv);
  const corsOptions = createCorsOptions(corsConfig.origins);

  // Optionally include security headers for integration testing
  // Apply helmet BEFORE CORS to ensure security headers are always present
  if (includeSecurityHeaders) {
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            connectSrc: ["'self'", "https://api.openai.com"],
          },
        },
        hsts: false, // Disable for testing
      }),
    );
  }

  app.use(cors(corsOptions));

  // Test route
  app.get("/test", (_req, res) => {
    res.json({ success: true, message: "CORS test endpoint" });
  });

  return app;
};

describe("CORS Security Configuration", () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment to development defaults
    process.env = { ...originalEnv };
    process.env.NODE_ENV = "development";
    process.env.ALLOWED_ORIGINS = "http://localhost:3000";
    process.env.ALLOWED_GCS_BUCKETS = "test-bucket,another-bucket";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore original environment
    process.env = originalEnv;
  });

  describe("Allowed Origins", () => {
    it("should allow requests from localhost:3000 (Next.js client)", async () => {
      process.env.ALLOWED_ORIGINS = "http://localhost:3000";
      app = createTestApp();

      const response = await request(app)
        .get("/test")
        .set("Origin", "http://localhost:3000")
        .expect(200);

      expect(response.headers["access-control-allow-origin"]).toBe(
        "http://localhost:3000",
      );
      expect(response.body).toEqual({
        success: true,
        message: "CORS test endpoint",
      });
    });

    it("should allow requests with no origin (mobile apps, Postman, etc.)", async () => {
      process.env.ALLOWED_ORIGINS = "http://localhost:3000";
      app = createTestApp();

      const response = await request(app).get("/test").expect(200);

      expect(response.body).toEqual({
        success: true,
        message: "CORS test endpoint",
      });
    });

    it("should allow additional origins from ALLOWED_ORIGINS env var in development", async () => {
      process.env.ALLOWED_ORIGINS =
        "http://localhost:3000,http://localhost:3001,https://staging.example.com";
      app = createTestApp();

      // Test additional origin
      const response = await request(app)
        .get("/test")
        .set("Origin", "http://localhost:3001")
        .expect(200);

      expect(response.headers["access-control-allow-origin"]).toBe(
        "http://localhost:3001",
      );
    });
  });

  describe("Blocked Origins", () => {
    it("should block unauthorized origins", async () => {
      process.env.ALLOWED_ORIGINS = "http://localhost:3000";
      app = createTestApp();

      const response = await request(app)
        .get("/test")
        .set("Origin", "https://malicious-site.com")
        .expect(500); // CORS error results in 500

      expect(response.text).toContain(
        "Origin https://malicious-site.com not allowed by CORS policy",
      );
    });

    it("should block common attack origins", async () => {
      process.env.ALLOWED_ORIGINS = "http://localhost:3000";
      app = createTestApp();

      const attackOrigins = [
        "https://evil.com",
        "http://attacker.localhost",
        "https://localhost.evil.com",
        "file://",
        "data:",
      ];

      for (const origin of attackOrigins) {
        const response = await request(app)
          .get("/test")
          .set("Origin", origin)
          .expect(500);

        expect(response.text).toContain("not allowed by CORS policy");
      }
    });
  });

  describe("Production Configuration", () => {
    it("should use only ALLOWED_ORIGINS in production mode", async () => {
      process.env.NODE_ENV = "production";
      process.env.ALLOWED_ORIGINS =
        "https://production-app.com,https://staging-app.com";
      app = createTestApp();

      // Production origin should work
      await request(app)
        .get("/test")
        .set("Origin", "https://production-app.com")
        .expect(200);

      // Development origin should be blocked in production
      await request(app)
        .get("/test")
        .set("Origin", "http://localhost:3000")
        .expect(500);
    });

    it("should require ALLOWED_ORIGINS in all environments", () => {
      process.env.NODE_ENV = "development";
      delete process.env.ALLOWED_ORIGINS;

      // Should throw validation error instead of creating app
      expect(() => {
        createTestApp();
      }).toThrow("ALLOWED_ORIGINS is required in all environments");
    });
  });

  describe("CORS Headers and Methods", () => {
    it("should set proper credentials and headers policies", async () => {
      process.env.ALLOWED_ORIGINS = "http://localhost:3000";
      app = createTestApp();

      const response = await request(app)
        .options("/test")
        .set("Origin", "http://localhost:3000")
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "X-OpenAI-API-Key,Content-Type")
        .expect(200);

      expect(response.headers["access-control-allow-credentials"]).toBe("true");
      expect(response.headers["access-control-allow-methods"]).toContain(
        "POST",
      );
      expect(response.headers["access-control-allow-headers"]).toContain(
        "X-OpenAI-API-Key",
      );
    });

    it("should allow API key headers for LLM requests", async () => {
      process.env.ALLOWED_ORIGINS = "http://localhost:3000";
      app = createTestApp();

      const response = await request(app)
        .get("/test")
        .set("Origin", "http://localhost:3000")
        .set("X-OpenAI-API-Key", "test-api-key")
        .set("Content-Type", "application/json")
        .expect(200);

      expect(response.headers["access-control-allow-origin"]).toBe(
        "http://localhost:3000",
      );
    });

    it("should set preflight cache to 24 hours", async () => {
      process.env.ALLOWED_ORIGINS = "http://localhost:3000";
      app = createTestApp();

      const response = await request(app)
        .options("/test")
        .set("Origin", "http://localhost:3000")
        .set("Access-Control-Request-Method", "POST")
        .expect(200);

      expect(response.headers["access-control-max-age"]).toBe("86400");
    });
  });

  describe("Security Regression Prevention", () => {
    it("should not allow wildcard origins", async () => {
      process.env.ALLOWED_ORIGINS = "http://localhost:3000";
      app = createTestApp();

      // Wildcard should not work (this would be a security vulnerability)
      await request(app).get("/test").set("Origin", "*").expect(500);
    });

    it("should maintain allowlist-only approach", async () => {
      process.env.ALLOWED_ORIGINS = "http://localhost:3000";
      app = createTestApp();

      // Any non-allowlisted origin should fail
      const randomOrigins = [
        "https://random1.com",
        "https://github.com",
        "https://google.com",
        "https://evil-domain.com",
      ];

      for (const origin of randomOrigins) {
        await request(app).get("/test").set("Origin", origin).expect(500);
      }
    });
  });

  describe("Environment Variable Parsing", () => {
    it("should properly parse comma-separated ALLOWED_ORIGINS", async () => {
      process.env.ALLOWED_ORIGINS = "  https://app1.com  ,  https://app2.com  ";
      app = createTestApp();

      // Both origins should work (with whitespace trimmed)
      await request(app)
        .get("/test")
        .set("Origin", "https://app1.com")
        .expect(200);

      await request(app)
        .get("/test")
        .set("Origin", "https://app2.com")
        .expect(200);
    });

    it("should reject empty ALLOWED_ORIGINS", () => {
      process.env.ALLOWED_ORIGINS = "   ";

      // Should throw validation error for empty origins
      expect(() => {
        createTestApp();
      }).toThrow("ALLOWED_ORIGINS must contain at least one valid origin");
    });
  });

  describe("CORS with Security Headers Integration", () => {
    it("should include both CORS and security headers in responses", async () => {
      app = createTestApp(true); // Include security headers

      const response = await request(app)
        .get("/test")
        .set("Origin", "http://localhost:3000")
        .expect(200);

      // CORS headers
      expect(response.headers["access-control-allow-origin"]).toBe(
        "http://localhost:3000",
      );

      // Security headers
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(response.headers["x-powered-by"]).toBeUndefined();
      expect(response.headers["content-security-policy"]).toContain(
        "default-src 'self'",
      );
    });

    it("should apply security headers even when CORS blocks requests", async () => {
      app = createTestApp(true); // Include security headers

      const response = await request(app)
        .get("/test")
        .set("Origin", "https://malicious-site.com")
        .expect(500);

      // Should have CORS error
      expect(response.text).toContain("not allowed by CORS policy");

      // Security headers should still be applied (helmet runs before CORS now)
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      // X-Powered-By should be removed by helmet (Express adds it by default)
      expect(response.headers["x-powered-by"]).toBeUndefined();
    });

    it("should handle preflight requests with both middleware", async () => {
      app = createTestApp(true); // Include security headers

      const response = await request(app)
        .options("/test")
        .set("Origin", "http://localhost:3000")
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "Content-Type,X-OpenAI-API-Key")
        .expect(200);

      // CORS preflight headers
      expect(response.headers["access-control-allow-methods"]).toContain(
        "POST",
      );
      expect(response.headers["access-control-allow-headers"]).toContain(
        "X-OpenAI-API-Key",
      );

      // Security headers should also be present (at minimum X-Content-Type-Options)
      expect(response.headers["x-content-type-options"]).toBeDefined();
    });

    it("should maintain API functionality with both middleware", async () => {
      app = createTestApp(true); // Include security headers

      // Add a POST route to test API functionality
      app.post("/api/test", express.json(), (_req, res) => {
        res.json({ success: true, data: "API response" });
      });

      const response = await request(app)
        .post("/api/test")
        .set("Origin", "http://localhost:3000")
        .set("Content-Type", "application/json")
        .send({ test: "data" })
        .expect(200);

      // Should work with both middleware
      expect(response.body.success).toBe(true);
      expect(response.headers["access-control-allow-origin"]).toBe(
        "http://localhost:3000",
      );
      expect(response.headers["content-security-policy"]).toBeDefined();
    });
  });
});
