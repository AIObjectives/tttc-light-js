import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import cors from "cors";
import create from "./routes/create";
import ensureUser from "./routes/ensureUser";
import feedback from "./routes/feedback";
import authEvents from "./routes/authEvents";
import { validateEnv } from "./types/context";
import { contextMiddleware } from "./middleware";
import { setupWorkers } from "./workers";
import { getReportStatusHandler, getReportDataHandler } from "./routes/report";
import { setupConnection } from "./Queue";

const port = process.env.PORT || 8080;

const env = validateEnv();

const app = express();
app.use(cors());
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

/**
 * Creates report
 */
app.post("/create", defaultRateLimiter, create);

/**
 * Ensures user document exists in Firestore
 */
app.post("/ensure-user", defaultRateLimiter, ensureUser);

/**
 * Submits user feedback
 */
app.post("/feedback", defaultRateLimiter, feedback);

/**
 * Logs authentication events (signin/signout)
 */
app.post("/auth-events", defaultRateLimiter, authEvents);

/**
 * Gets a report
 */
app.get(
  "/report/:reportUri/status",
  defaultRateLimiter,
  getReportStatusHandler,
);
app.get("/report/:reportUri/data", defaultRateLimiter, getReportDataHandler);

app.get("/test", async (req, res) => {
  return res.send("hi");
});

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
