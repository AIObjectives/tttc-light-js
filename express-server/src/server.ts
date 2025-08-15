import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import cors from "cors";
import helmet from "helmet";
import create from "./routes/create";
import ensureUser from "./routes/ensureUser";
import feedback from "./routes/feedback";
import authEvents from "./routes/authEvents";
import { validateEnv } from "./types/context";
import { contextMiddleware } from "./middleware";
import { setupWorkers } from "./workers";
import { getReportStatusHandler, getReportDataHandler } from "./routes/report";
import { setupConnection } from "./Queue";
import {
  getAllowedOrigins,
  createCorsOptions,
  logCorsConfiguration,
} from "./utils/corsConfig";
import {
  initializeFeatureFlags,
  shutdownFeatureFlags,
  isFeatureEnabled,
} from "./featureFlags";

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

// Adds context middleware - lets us pass things like env variables
app.use(contextMiddleware(env));

const { connection, pipelineQueue: plq } = setupConnection(env);

export const pipelineQueue = plq;

// Initialize feature flags
initializeFeatureFlags(env);

// This is added here so that the worker gets initialized. Queue is referenced in /create, so its initialized there.
setupWorkers(connection, env.REDIS_QUEUE_NAME);

const defaultRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: {
      message: "Too many requests, please try again later.",
      code: "RateLimitExceeded",
    },
  },
});

// Skip rate limiting in development
const rateLimiter =
  process.env.NODE_ENV === "production"
    ? defaultRateLimiter
    : (_req: Request, _res: Response, next: NextFunction) => next();

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
app.get("/report/:reportUri/status", rateLimiter, getReportStatusHandler);
app.get("/report/:reportUri/data", rateLimiter, getReportDataHandler);

app.get("/test", async (_req, res) => {
  return res.send("hi");
});

const server = app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});

// Graceful shutdown handling
async function gracefulShutdown(signal: string) {
  console.log(`Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async (err) => {
    if (err) {
      console.error("Error during server shutdown:", err);
      process.exit(1);
    }

    console.log("HTTP server closed");

    try {
      // Close Redis connection
      if (connection) {
        await connection.disconnect();
        console.log("Redis connection closed");
      }

      // Shutdown feature flags
      await shutdownFeatureFlags();
      console.log("Feature flags shutdown complete");

      console.log("Graceful shutdown complete");
      process.exit(0);
    } catch (error) {
      console.error("Error during graceful shutdown:", error);
      process.exit(1);
    }
  });

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    console.error("Graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, 10000); // 10 second timeout
}

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
