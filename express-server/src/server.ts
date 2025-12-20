import "dotenv/config";
import cors from "cors";
import express, { type NextFunction, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import Redis from "ioredis";
import pinoHttp from "pino-http";
import { type RedisReply, RedisStore } from "rate-limit-redis";
import {
  ERROR_CODES,
  ERROR_MESSAGES,
  getErrorStatusCode,
} from "tttc-common/errors";
import { logger } from "tttc-common/logger";
import {
  initializeAnalyticsClient,
  shutdownAnalyticsClient,
} from "./analytics";
import { initializeFeatureFlags, shutdownFeatureFlags } from "./featureFlags";
import { contextMiddleware } from "./middleware";
import { createQueue } from "./queue";
import authEvents from "./routes/authEvents";
import create from "./routes/create";
import ensureUser from "./routes/ensureUser";
import feedback from "./routes/feedback";
import { updateProfile } from "./routes/profile";
import {
  getUnifiedReportHandler,
  migrateReportUrlHandler,
} from "./routes/report";
import { getUserLimits } from "./routes/user";
import { validateEnv } from "./types/context";
import type { RequestWithLogger } from "./types/request";
import {
  createCorsOptions,
  getAllowedOrigins,
  logCorsConfiguration,
} from "./utils/corsConfig";

const serverLogger = logger.child({ module: "server" });

const port = process.env.PORT || 8080;

const env = validateEnv();

const app = express();

// CORS Security Configuration
const corsConfig = getAllowedOrigins(env);
const corsOptions = createCorsOptions(corsConfig.origins);

// Log CORS configuration for debugging
logCorsConfiguration(corsConfig);

// Security headers middleware - Apply BEFORE CORS to ensure headers are always present
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "https://api.openai.com"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts:
      process.env.NODE_ENV === "production"
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          }
        : false,
  }),
);

app.use(cors(corsOptions));
// Required to use express-rate-limit with CloudRun, but doesn't apply to local
if (process.env.NODE_ENV === "production") {
  // Could be its own env var, but correct for now.
  app.set("trust proxy", 1);
}
app.use(express.json({ limit: "50mb" }));
app.use(express.static("public"));

// HTTP request logging with pino
app.use(pinoHttp({ logger }));

// Adds context middleware - lets us pass things like env variables
app.use(contextMiddleware(env));

// Create and start the queue
const pipelineQueue = createQueue(env);
pipelineQueue.listen().catch(async (error: Error) => {
  serverLogger.error(
    { error },
    "Failed to start pipeline queue listener - exiting",
  );
  await gracefulShutdown("QUEUE_LISTEN_ERROR");
});

// Create Redis connection for rate limiting
const redisConnection = new Redis(env.REDIS_URL, {
  connectionName: "Express-Pipeline",
  maxRetriesPerRequest: null,
});

export { pipelineQueue };

// Initialize feature flags
initializeFeatureFlags(env);

// Initialize analytics client (non-blocking)
initializeAnalyticsClient(env);

// Queue is now listening for jobs automatically

const rateLimitPrefix = env.RATE_LIMIT_PREFIX;

// Rate limit monitoring logger
const rateLimitLogger = logger.child({ module: "rate-limiter" });

// Rate limit configuration constants
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const REPORT_LIMIT_MAX = 2000; // requests per window
const AUTH_LIMIT_MAX = 5000; // requests per window

// Helper function to create rate limit handler
const createRateLimitHandler = (
  limitType: "auth" | "report",
  limit: number,
  windowMs: number,
) => {
  return (req: RequestWithLogger, res: Response) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const endpoint = req.path;

    const logFn =
      limitType === "auth" ? rateLimitLogger.error : rateLimitLogger.warn;
    const message =
      limitType === "auth"
        ? "Auth rate limit exceeded - critical path blocked"
        : "Report rate limit exceeded";

    logFn(
      {
        ip,
        endpoint,
        limitType,
        limit,
        window: `${windowMs / 60000}min`,
      },
      message,
    );

    res.status(getErrorStatusCode(ERROR_CODES.RATE_LIMIT_EXCEEDED)).json({
      error: {
        message: ERROR_MESSAGES[ERROR_CODES.RATE_LIMIT_EXCEEDED],
        code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        retryAfter: Math.ceil(windowMs / 1000),
      },
    });
  };
};

const defaultRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: {
      message: ERROR_MESSAGES[ERROR_CODES.RATE_LIMIT_EXCEEDED],
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
    },
  },
  store: new RedisStore({
    sendCommand: (command: string, ...args: string[]) =>
      redisConnection.call(command, ...args) as Promise<RedisReply>,
    prefix: `${rateLimitPrefix}-rate-limit-default`,
  }),
});

// Rate limiter for report endpoints
// Supports report creation, retrieval, and polling during generation
// Handles multiple concurrent users from same IP (corporate networks/NAT)
const reportRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: REPORT_LIMIT_MAX,
  message: {
    error: {
      message: ERROR_MESSAGES[ERROR_CODES.RATE_LIMIT_EXCEEDED],
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
    },
  },
  store: new RedisStore({
    sendCommand: (command: string, ...args: string[]) =>
      redisConnection.call(command, ...args) as Promise<RedisReply>,
    prefix: `${rateLimitPrefix}-rate-limit-report`,
  }),
  handler: createRateLimitHandler(
    "report",
    REPORT_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS,
  ),
});

// Rate limiter for auth endpoints
// Critical path - must remain accessible for users to log in and use the app
// Lightweight operations: Firestore writes, no LLM calls
// High limit to handle multiple concurrent users from same IP
const authRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: AUTH_LIMIT_MAX,
  message: {
    error: {
      message: ERROR_MESSAGES[ERROR_CODES.RATE_LIMIT_EXCEEDED],
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
    },
  },
  store: new RedisStore({
    sendCommand: (command: string, ...args: string[]) =>
      redisConnection.call(command, ...args) as Promise<RedisReply>,
    prefix: `${rateLimitPrefix}-rate-limit-auth`,
  }),
  handler: createRateLimitHandler("auth", AUTH_LIMIT_MAX, RATE_LIMIT_WINDOW_MS),
});

// Skip rate limiting in development
const _rateLimiter =
  process.env.NODE_ENV === "production"
    ? defaultRateLimiter
    : (_req: RequestWithLogger, _res: Response, next: NextFunction) => next();

const reportLimiter =
  process.env.NODE_ENV === "production"
    ? reportRateLimiter
    : (_req: RequestWithLogger, _res: Response, next: NextFunction) => next();

const authLimiter =
  process.env.NODE_ENV === "production"
    ? authRateLimiter
    : (_req: RequestWithLogger, _res: Response, next: NextFunction) => next();

/**
 * Creates report
 * Uses reportLimiter (2000 req/15min per IP)
 */
app.post("/create", reportLimiter, create);

/**
 * Ensures user document exists in Firestore
 * Uses authLimiter (5000 req/15min per IP) - critical path for user authentication
 */
app.post("/ensure-user", authLimiter, ensureUser);

/**
 * Submits user feedback
 * Uses authLimiter (5000 req/15min per IP)
 */
app.post("/feedback", authLimiter, feedback);

/**
 * Logs authentication events (signin/signout)
 * Uses authLimiter (5000 req/15min per IP)
 */
app.post("/auth-events", authLimiter, authEvents);

/**
 * Migrates legacy report URL to new ID-based URL
 */
app.get("/report/:reportUri/migrate", reportLimiter, migrateReportUrlHandler);

/**
 * Get the current user's capabilities and limits
 * Uses authLimiter (5000 req/15min per IP)
 */
app.get("/api/user/limits", authLimiter, getUserLimits);

/**
 * Update user profile (progressive profiling for monday.com CRM)
 * Uses authLimiter (5000 req/15min per IP)
 */
app.post("/api/profile/update", authLimiter, updateProfile);

/**
 * Unified report endpoint - handles both Firebase IDs and legacy bucket URLs
 */
app.get("/report/:identifier", reportLimiter, getUnifiedReportHandler);

app.get("/test", async (_req, res) => {
  return res.send("hi");
});

const server = app.listen(port, (err?: Error) => {
  if (err) {
    serverLogger.error({ error: err, port }, "Failed to start server");
    process.exit(1);
  }
  serverLogger.info({ port }, "Server started");
});

// Graceful shutdown handling
async function gracefulShutdown(signal: string) {
  serverLogger.info({ signal }, "Starting graceful shutdown");

  // Stop accepting new connections
  server.close(async (err) => {
    if (err) {
      serverLogger.error({ error: err }, "Error during server shutdown");
      process.exit(1);
    }

    serverLogger.info("HTTP server closed");

    try {
      // Close queue connection
      if (pipelineQueue) {
        await pipelineQueue.close();
        serverLogger.info("Queue connection closed");
      }

      // Close Redis connection for rate limiting
      if (redisConnection) {
        redisConnection.disconnect();
        serverLogger.info("Redis connection closed");
      }

      // Shutdown feature flags
      await shutdownFeatureFlags();
      serverLogger.info("Feature flags shutdown complete");

      // Shutdown analytics client
      await shutdownAnalyticsClient();
      serverLogger.info("Analytics client shutdown complete");

      serverLogger.info("Graceful shutdown complete");
      process.exit(0);
    } catch (error) {
      serverLogger.error({ error }, "Error during graceful shutdown");
      process.exit(1);
    }
  });

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    serverLogger.error("Graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, 10000); // 10 second timeout
}

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
