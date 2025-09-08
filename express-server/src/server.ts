import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import { RequestWithLogger } from "./types/request";
import rateLimit from "express-rate-limit";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { logger } from "tttc-common/logger";
import create from "./routes/create";
import ensureUser from "./routes/ensureUser";
import feedback from "./routes/feedback";
import authEvents from "./routes/authEvents";

import { validateEnv } from "./types/context";
import { contextMiddleware } from "./middleware";
import { setupWorkers } from "./workers";
import {
  getReportStatusHandler,
  getReportDataHandler,
  getReportByIdDataHandler,
  getReportByIdStatusHandler,
  getReportByIdMetadataHandler,
  migrateReportUrlHandler,
} from "./routes/report";
import { setupConnection } from "./Queue";
import {
  getAllowedOrigins,
  createCorsOptions,
  logCorsConfiguration,
} from "./utils/corsConfig";
import { initializeFeatureFlags, shutdownFeatureFlags } from "./featureFlags";
import {
  initializeAnalyticsClient,
  shutdownAnalyticsClient,
} from "./analytics";

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

const { connection, pipelineQueue: plq } = setupConnection(env);

export const pipelineQueue = plq;

// Initialize feature flags
initializeFeatureFlags(env);

// Initialize analytics client (non-blocking)
initializeAnalyticsClient(env);

// This is added here so that the worker gets initialized. Queue is referenced in /create, so its initialized there.
setupWorkers(connection, env.REDIS_QUEUE_NAME);

const rateLimitPrefix = env.RATE_LIMIT_PREFIX;

const defaultRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: {
      message: "Too many requests, please try again later.",
      code: "RateLimitExceeded",
    },
  },
  store: new RedisStore({
    sendCommand: (command: string, ...args: string[]) =>
      connection.call(command, ...args) as Promise<RedisReply>,
    prefix: `${rateLimitPrefix}-rate-limit-default`,
  }),
});

// Stricter rate limiter for report endpoints
const reportRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 60, // Limit each IP to 60 report requests per windowMs (1 per 5 seconds)
  message: {
    error: {
      message: "Too many requests, please try again later.",
      code: "RateLimitExceeded",
    },
  },
  store: new RedisStore({
    sendCommand: (command: string, ...args: string[]) =>
      connection.call(command, ...args) as Promise<RedisReply>,
    prefix: `${rateLimitPrefix}-rate-limit-report`,
  }),
});

// Skip rate limiting in development
const rateLimiter =
  process.env.NODE_ENV === "production"
    ? defaultRateLimiter
    : (_req: RequestWithLogger, _res: Response, next: NextFunction) => next();

const reportLimiter =
  process.env.NODE_ENV === "production"
    ? reportRateLimiter
    : (_req: RequestWithLogger, _res: Response, next: NextFunction) => next();

/**
 * Creates report
 */
app.post("/create", rateLimiter, create);

/**
 * Ensures user document exists in Firestore
 */
app.post("/ensure-user", rateLimiter, ensureUser);

/**
 * Submits user feedback
 */
app.post("/feedback", rateLimiter, feedback);

/**
 * Logs authentication events (signin/signout)
 */
app.post("/auth-events", rateLimiter, authEvents);

/**
 * Gets a report
 */
app.get("/report/:reportUri/status", reportLimiter, getReportStatusHandler);
app.get("/report/:reportUri/data", reportLimiter, getReportDataHandler);

/**
 * Gets a report by Firebase document ID (requires authentication)
 */
app.get("/report/id/:reportId/data", reportLimiter, getReportByIdDataHandler);
app.get(
  "/report/id/:reportId/status",
  reportLimiter,
  getReportByIdStatusHandler,
);
app.get(
  "/report/id/:reportId/metadata",
  rateLimiter, // Use default rate limiter (100 req/15 min) for read-only metadata
  getReportByIdMetadataHandler,
);

/**
 * Migrates legacy report URL to new ID-based URL
 */
app.get("/report/:reportUri/migrate", reportLimiter, migrateReportUrlHandler);

app.get("/test", async (_req, res) => {
  return res.send("hi");
});

const server = app.listen(port, () => {
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
      // Close Redis connection
      if (connection) {
        connection.disconnect();
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
