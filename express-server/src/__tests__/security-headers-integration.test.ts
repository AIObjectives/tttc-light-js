import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import cors from "cors";
import helmet from "helmet";
import { getAllowedOrigins, createCorsOptions } from "../utils/corsConfig";
import { validateEnv } from "../types/context";

describe("CORS + Security Headers Integration", () => {
  let app: express.Application;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NODE_ENV = "development";
    app = express();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should apply both CORS and security headers in correct order", async () => {
    // Apply middleware in same order as server.ts
    const env = validateEnv();
    const corsConfig = getAllowedOrigins(env);
    const corsOptions = createCorsOptions(corsConfig.origins);

    // Apply helmet BEFORE CORS to ensure security headers are always present
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            connectSrc: ["'self'", "https://api.openai.com"],
          },
        },
        hsts: false,
      }),
    );
    app.use(cors(corsOptions));

    app.get("/test", (_req, res) => res.json({ success: true }));

    const response = await request(app)
      .get("/test")
      .set("Origin", "http://localhost:3000")
      .expect(200);

    // CORS headers should be present
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );

    // Security headers should be present
    expect(response.headers["content-security-policy"]).toContain(
      "default-src 'self'",
    );
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("should handle CORS preflight with security headers", async () => {
    const env = validateEnv();
    const corsConfig = getAllowedOrigins(env);
    const corsOptions = createCorsOptions(corsConfig.origins);

    app.use(helmet({ hsts: false }));
    app.use(cors(corsOptions));
    app.get("/api/test", (_req, res) => res.json({ success: true }));

    const response = await request(app)
      .options("/api/test")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "Content-Type,X-OpenAI-API-Key")
      .expect(200);

    // Both CORS and security headers should be present on preflight
    expect(response.headers["access-control-allow-methods"]).toContain("POST");
    expect(response.headers["access-control-allow-headers"]).toContain(
      "X-OpenAI-API-Key",
    );
    expect(response.headers["content-security-policy"]).toBeDefined();
  });

  it("should maintain HSTS only in production with CORS", async () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOWED_ORIGINS = "https://production-app.com";

    const env = validateEnv();
    const corsConfig = getAllowedOrigins(env);
    const corsOptions = createCorsOptions(corsConfig.origins);

    app.use(
      helmet({
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
      }),
    );
    app.use(cors(corsOptions));

    app.get("/test", (_req, res) => res.json({ success: true }));

    const response = await request(app)
      .get("/test")
      .set("Origin", "https://production-app.com")
      .expect(200);

    expect(response.headers["strict-transport-security"]).toBe(
      "max-age=31536000; includeSubDomains; preload",
    );
    expect(response.headers["access-control-allow-origin"]).toBe(
      "https://production-app.com",
    );
  });

  it("should block unauthorized origins but still apply security headers", async () => {
    const env = validateEnv();
    const corsConfig = getAllowedOrigins(env);
    const corsOptions = createCorsOptions(corsConfig.origins);

    app.use(helmet({ hsts: false }));
    app.use(cors(corsOptions));
    app.get("/test", (_req, res) => res.json({ success: true }));

    const response = await request(app)
      .get("/test")
      .set("Origin", "https://malicious-site.com")
      .expect(500);

    // Should have CORS error
    expect(response.text).toContain("not allowed by CORS policy");

    // Security headers should still be applied (helmet runs after CORS)
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    // X-Powered-By is removed by helmet by default
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("should handle API endpoints with both middleware", async () => {
    const env = validateEnv();
    const corsConfig = getAllowedOrigins(env);
    const corsOptions = createCorsOptions(corsConfig.origins);

    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            connectSrc: ["'self'", "https://api.openai.com"],
          },
        },
        hsts: false,
      }),
    );
    app.use(cors(corsOptions));

    // Simulate API endpoint like /create
    app.post("/create", express.json(), (_req, res) =>
      res.json({ success: true }),
    );

    const response = await request(app)
      .post("/create")
      .set("Origin", "http://localhost:3000")
      .set("Content-Type", "application/json")
      .send({ test: "data" })
      .expect(200);

    // Verify both sets of headers
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
    expect(response.headers["content-security-policy"]).toContain(
      "connect-src 'self' https://api.openai.com",
    );
  });

  it("should allow OpenAI API connections in CSP", async () => {
    const env = validateEnv();
    const corsConfig = getAllowedOrigins(env);
    const corsOptions = createCorsOptions(corsConfig.origins);

    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            connectSrc: ["'self'", "https://api.openai.com"],
          },
        },
        hsts: false,
      }),
    );
    app.use(cors(corsOptions));

    app.get("/test", (_req, res) => res.json({ success: true }));

    const response = await request(app)
      .get("/test")
      .set("Origin", "http://localhost:3000")
      .expect(200);

    expect(response.headers["content-security-policy"]).toContain(
      "https://api.openai.com",
    );
  });

  it("should handle trust proxy with security headers in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOWED_ORIGINS = "https://production-app.com";

    const env = validateEnv();
    const corsConfig = getAllowedOrigins(env);
    const corsOptions = createCorsOptions(corsConfig.origins);

    // Simulate production setup with trust proxy
    app.set("trust proxy", 1);
    app.use(
      helmet({
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
      }),
    );
    app.use(cors(corsOptions));

    app.get("/test", (_req, res) => res.json({ success: true }));

    const response = await request(app)
      .get("/test")
      .set("Origin", "https://production-app.com")
      .set("X-Forwarded-Proto", "https")
      .expect(200);

    expect(response.headers["strict-transport-security"]).toBeDefined();
    expect(response.headers["access-control-allow-origin"]).toBe(
      "https://production-app.com",
    );
  });
});
