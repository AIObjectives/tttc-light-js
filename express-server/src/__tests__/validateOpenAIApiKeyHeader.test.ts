import express from "express";
import pinoHttp from "pino-http";
import request from "supertest";
import { logger } from "tttc-common/logger";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Firebase to avoid initialization with dummy credentials
vi.mock("../Firebase", () => ({
  verifyUser: vi.fn(),
}));

import { validateOpenAIApiKeyHeader } from "../middleware";

describe("validateOpenAIApiKeyHeader middleware", () => {
  let app: express.Application;

  // Test constants
  const TEST_KEY_LENGTH = 48;
  const TEST_ENDPOINT = "/test";
  const TEST_PAYLOAD = { test: "data" };
  const INVALID_CHARS = "@#";
  const CONTROL_CHARS = "\r\n";
  const NULL_BYTES = "\x00\x00";

  /**
   * Creates a valid OpenAI API key for testing
   * @param length - Length of the suffix (default: 48)
   * @returns Valid API key string
   */
  const createValidKey = (length: number = TEST_KEY_LENGTH) =>
    `sk-${"A".repeat(length)}`;

  /**
   * Creates a mixed alphanumeric valid API key for testing
   * @returns Valid API key with mixed characters
   */
  const createMixedValidKey = () =>
    "sk-A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4";

  /**
   * Creates a realistic-looking API key for testing
   * @returns Realistic API key string
   */
  const createRealisticKey = () =>
    "sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHijkl";

  /**
   * Asserts that the response is a success response
   * @param response - The response object to check
   */
  const expectSuccessResponse = (response: any) => {
    expect(response.body).toEqual({ success: true });
  };

  /**
   * Asserts that the response is an error response with expected structure
   * @param response - The response object to check
   * @param code - Expected error code
   * @param message - Optional expected error message
   */
  const expectErrorResponse = (
    response: any,
    code: string,
    message?: string,
  ) => {
    expect(response.body.error.code).toBe(code);
    if (message) {
      expect(response.body.error.message).toBe(message);
    }
    expect(response.body.error.timestamp).toBeDefined();
  };

  /**
   * Creates a test Express app with optional custom middleware setup
   * @param setupFn - Optional function to customize the app setup
   * @param useValidation - Whether to apply the validation middleware (default: true)
   * @returns Configured Express application
   */
  const createTestApp = (
    setupFn?: (app: express.Application) => void,
    useValidation: boolean = true,
  ) => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use(pinoHttp({ logger }));

    if (setupFn) {
      setupFn(testApp);
    }

    if (useValidation) {
      testApp.use(validateOpenAIApiKeyHeader());
    }

    testApp.post(TEST_ENDPOINT, (_req, res) => res.json({ success: true }));
    return testApp;
  };

  /**
   * Creates a test request with optional API key header
   * @param app - Express application to test against
   * @param key - Optional API key to include in header
   * @returns Supertest request object
   */
  const createTestRequestWithKey = (app: express.Application, key?: string) => {
    const req = request(app).post(TEST_ENDPOINT).send(TEST_PAYLOAD);
    return key ? req.set("X-OpenAI-API-Key", key) : req;
  };

  beforeEach(() => {
    app = createTestApp();
  });

  describe("Missing header validation", () => {
    it("should reject requests without X-OpenAI-API-Key header", async () => {
      const response = await createTestRequestWithKey(app).expect(401);
      expectErrorResponse(
        response,
        "MISSING_API_KEY_HEADER",
        "Missing X-OpenAI-API-Key header",
      );
    });

    it("should reject requests with empty X-OpenAI-API-Key header", async () => {
      const response = await createTestRequestWithKey(app, "").expect(401);
      expectErrorResponse(
        response,
        "MISSING_API_KEY_HEADER",
        "Missing X-OpenAI-API-Key header",
      );
    });
  });

  describe("Format validation", () => {
    it("should accept valid OpenAI API key format", async () => {
      const response = await createTestRequestWithKey(
        app,
        createValidKey(),
      ).expect(200);
      expectSuccessResponse(response);
    });

    it("should reject keys that don't start with 'sk-'", async () => {
      const invalidKey = `pk-${"A".repeat(48)}`;
      const response = await createTestRequestWithKey(app, invalidKey).expect(
        401,
      );
      expectErrorResponse(
        response,
        "INVALID_API_KEY_FORMAT",
        "Invalid OpenAI API key format. Expected format: sk-{48 alphanumeric characters}",
      );
    });

    it("should reject keys that are too short", async () => {
      const response = await createTestRequestWithKey(
        app,
        createValidKey(30),
      ).expect(401);
      expectErrorResponse(response, "INVALID_API_KEY_FORMAT");
    });

    it("should reject keys that are too long", async () => {
      const response = await createTestRequestWithKey(
        app,
        createValidKey(60),
      ).expect(401);
      expectErrorResponse(response, "INVALID_API_KEY_FORMAT");
    });

    it("should reject keys with invalid characters", async () => {
      const invalidKey = `sk-${"A".repeat(46)}${INVALID_CHARS}`;
      const response = await createTestRequestWithKey(app, invalidKey).expect(
        401,
      );
      expectErrorResponse(response, "INVALID_API_KEY_FORMAT");
    });

    it("should accept keys with mixed alphanumeric characters", async () => {
      const response = await createTestRequestWithKey(
        app,
        createMixedValidKey(),
      ).expect(200);
      expectSuccessResponse(response);
    });
  });

  describe("Header case sensitivity", () => {
    it("should accept lowercase header name", async () => {
      const response = await request(app)
        .post("/test")
        .set("x-openai-api-key", createValidKey())
        .send({ test: "data" })
        .expect(200);
      expectSuccessResponse(response);
    });

    it("should accept uppercase header name", async () => {
      const response = await request(app)
        .post("/test")
        .set("X-OPENAI-API-KEY", createValidKey())
        .send({ test: "data" })
        .expect(200);
      expectSuccessResponse(response);
    });
  });

  describe("Sanitization", () => {
    /**
     * Creates a test app that injects a corrupted API key into the request headers
     * @param corruptedKey - The corrupted key to inject
     * @returns Express application for testing
     */
    const createSanitizationTestApp = (corruptedKey: string) => {
      return createTestApp((app) => {
        app.use((req, _res, next) => {
          req.headers["x-openai-api-key"] = corruptedKey;
          next();
        });
      });
    };

    it("should sanitize keys with control characters via direct middleware test", async () => {
      const corruptedKey = `sk-${"A".repeat(46)}${CONTROL_CHARS}`;
      const testApp = createSanitizationTestApp(corruptedKey);

      const response = await request(testApp)
        .post(TEST_ENDPOINT)
        .send(TEST_PAYLOAD)
        .expect(401); // Should fail validation after sanitization due to length

      expectErrorResponse(response, "INVALID_API_KEY_FORMAT");
    });

    it("should sanitize keys with newlines via direct middleware test", async () => {
      const corruptedKey = `sk-${"A".repeat(46)}\n\r`;
      const testApp = createSanitizationTestApp(corruptedKey);

      const response = await request(testApp)
        .post(TEST_ENDPOINT)
        .send(TEST_PAYLOAD)
        .expect(401); // Should fail validation after sanitization

      expectErrorResponse(response, "INVALID_API_KEY_FORMAT");
    });

    it("should handle keys with null bytes via direct middleware test", async () => {
      const corruptedKey = `sk-${"A".repeat(46)}${NULL_BYTES}`;
      const testApp = createSanitizationTestApp(corruptedKey);

      const response = await request(testApp)
        .post(TEST_ENDPOINT)
        .send(TEST_PAYLOAD)
        .expect(401);

      expectErrorResponse(response, "INVALID_API_KEY_FORMAT");
    });
  });

  describe("Multiple headers handling", () => {
    it("should use first header when multiple headers with same name are present", async () => {
      const validKey = createValidKey();
      const invalidKey = "invalid-key";

      const testApp = createTestApp((app) => {
        app.use((req, _res, next) => {
          req.headers["x-openai-api-key"] = [validKey, invalidKey];
          next();
        });
      });

      const response = await request(testApp)
        .post(TEST_ENDPOINT)
        .send(TEST_PAYLOAD)
        .expect(200);

      expectSuccessResponse(response);
    });
  });

  describe("Edge cases", () => {
    it("should reject non-string header values", async () => {
      const testApp = createTestApp((app) => {
        app.use((req, _res, next) => {
          req.headers["x-openai-api-key"] = 12345 as any;
          next();
        });
      });

      const response = await request(testApp)
        .post(TEST_ENDPOINT)
        .send(TEST_PAYLOAD)
        .expect(401);

      expectErrorResponse(response, "INVALID_API_KEY_FORMAT");
    });

    it("should reject undefined header values in array", async () => {
      const testApp = createTestApp((app) => {
        app.use((req, _res, next) => {
          req.headers["x-openai-api-key"] = [
            undefined,
            createValidKey(),
          ] as any;
          next();
        });
      });

      const response = await request(testApp)
        .post(TEST_ENDPOINT)
        .send(TEST_PAYLOAD)
        .expect(401);

      expectErrorResponse(response, "INVALID_API_KEY_FORMAT");
    });
  });

  describe("Real-world scenarios", () => {
    it("should accept realistic OpenAI API key", async () => {
      const response = await createTestRequestWithKey(
        app,
        createRealisticKey(),
      ).expect(200);
      expectSuccessResponse(response);
    });

    it("should work with CORS preflight requests", async () => {
      // Create app that handles OPTIONS without requiring API key
      const corsApp = createTestApp((app) => {
        // Handle OPTIONS separately (typical CORS preflight)
        app.options(TEST_ENDPOINT, (_req, res) => {
          res.header("Access-Control-Allow-Origin", "*");
          res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
          res.header(
            "Access-Control-Allow-Headers",
            "Content-Type, X-OpenAI-API-Key",
          );
          res.sendStatus(200);
        });
      }, false); // Don't apply validation middleware globally

      // Apply validation middleware only to POST
      corsApp.post(TEST_ENDPOINT, validateOpenAIApiKeyHeader(), (_req, res) =>
        res.json({ success: true }),
      );

      // First, test OPTIONS preflight (should work without API key)
      await request(corsApp)
        .options(TEST_ENDPOINT)
        .set("Origin", "http://localhost:3000")
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "Content-Type,X-OpenAI-API-Key")
        .expect(200);

      // Then test actual request (requires API key)
      const response = await request(corsApp)
        .post(TEST_ENDPOINT)
        .set("X-OpenAI-API-Key", createValidKey())
        .send(TEST_PAYLOAD)
        .expect(200);

      expectSuccessResponse(response);
    });
  });
});
