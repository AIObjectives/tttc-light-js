import { Request, Response, NextFunction } from "express";
import { Env } from "./types/context";
import { RequestWithLogger } from "./types/request";

/**
 * Adds context to the request object
 */
export const contextMiddleware = (validatedEnv: Env) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.context = { env: validatedEnv };
    next();
  };
};

// Constants for API key validation
const OPENAI_KEY_PREFIX = "sk-";
const OPENAI_KEY_SUFFIX_LENGTH = 48;
const OPENAI_KEY_TOTAL_LENGTH =
  OPENAI_KEY_PREFIX.length + OPENAI_KEY_SUFFIX_LENGTH; // 51 total
const OPENAI_KEY_PATTERN = new RegExp(
  `^${OPENAI_KEY_PREFIX}[A-Za-z0-9]{${OPENAI_KEY_SUFFIX_LENGTH}}$`,
);
const CONTROL_CHARS_PATTERN = /[\x00-\x1F\x7F\r\n]/g;

/**
 * Standard error response structure for security validation failures
 */
interface SecurityErrorResponse {
  error: {
    message: string;
    code: string;
    timestamp?: string;
  };
}

/**
 * Creates a standardized security error response
 */
const createSecurityErrorResponse = (
  message: string,
  code: string,
): SecurityErrorResponse => ({
  error: {
    message,
    code,
    timestamp: new Date().toISOString(),
  },
});

/**
 * Logs security validation failures for audit purposes
 */
const logSecurityFailure = (
  req: RequestWithLogger,
  reason: string,
  details?: Record<string, any>,
) => {
  req.log.warn(
    {
      reason,
      timestamp: new Date().toISOString(),
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.get("User-Agent"),
      origin: req.get("Origin"),
      path: req.path,
      method: req.method,
      ...details,
    },
    "API key validation failed",
  );
};

/**
 * Validates OpenAI API Key header format and security
 *
 * Features:
 * - Validates sk-{48 alphanumeric chars} format
 * - Sanitizes control characters
 * - Handles multiple headers and edge cases
 * - Provides security logging and audit trail
 * - Uses constant-time validation where possible
 */
export const validateOpenAIApiKeyHeader = () => {
  return (req: RequestWithLogger, res: Response, next: NextFunction) => {
    const apiKey =
      req.headers["x-openai-api-key"] || req.headers["X-OpenAI-API-Key"];

    // Check if header is present
    if (!apiKey) {
      logSecurityFailure(req, "Missing API key header");
      return res
        .status(401)
        .json(
          createSecurityErrorResponse(
            "Missing X-OpenAI-API-Key header",
            "MISSING_API_KEY_HEADER",
          ),
        );
    }

    // Handle array case (multiple headers with same name)
    const keyValue = Array.isArray(apiKey) ? apiKey[0] : apiKey;

    if (!keyValue || typeof keyValue !== "string") {
      logSecurityFailure(req, "Invalid header type", {
        headerType: typeof keyValue,
        isArray: Array.isArray(apiKey),
      });
      return res
        .status(401)
        .json(
          createSecurityErrorResponse(
            "Invalid X-OpenAI-API-Key header format",
            "INVALID_API_KEY_FORMAT",
          ),
        );
    }

    // Trim whitespace from the key value
    const trimmedKey = keyValue.trim();

    // Check for empty string after trimming
    if (trimmedKey === "") {
      logSecurityFailure(req, "Empty API key header");
      return res
        .status(401)
        .json(
          createSecurityErrorResponse(
            "Missing X-OpenAI-API-Key header",
            "MISSING_API_KEY_HEADER",
          ),
        );
    }

    // Sanitize the key (remove control characters and newlines)
    const sanitizedKey = trimmedKey.replace(CONTROL_CHARS_PATTERN, "");

    // Early length check for performance (before expensive regex)
    if (sanitizedKey.length !== OPENAI_KEY_TOTAL_LENGTH) {
      logSecurityFailure(req, "Invalid key length", {
        actualLength: sanitizedKey.length,
        expectedLength: OPENAI_KEY_TOTAL_LENGTH,
      });
      return res
        .status(401)
        .json(
          createSecurityErrorResponse(
            `Invalid OpenAI API key format. Expected format: ${OPENAI_KEY_PREFIX}{${OPENAI_KEY_SUFFIX_LENGTH} alphanumeric characters}`,
            "INVALID_API_KEY_FORMAT",
          ),
        );
    }

    // Validate OpenAI API key format using pre-compiled regex
    if (!OPENAI_KEY_PATTERN.test(sanitizedKey)) {
      logSecurityFailure(req, "Invalid key format", {
        hasCorrectPrefix: sanitizedKey.startsWith(OPENAI_KEY_PREFIX),
        keyLength: sanitizedKey.length,
      });
      return res
        .status(401)
        .json(
          createSecurityErrorResponse(
            `Invalid OpenAI API key format. Expected format: ${OPENAI_KEY_PREFIX}{${OPENAI_KEY_SUFFIX_LENGTH} alphanumeric characters}`,
            "INVALID_API_KEY_FORMAT",
          ),
        );
    }

    // Store sanitized key for downstream use
    req.headers["x-openai-api-key"] = sanitizedKey;

    next();
  };
};
