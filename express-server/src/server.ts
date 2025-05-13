import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import cors from "cors";
import create from "./routes/create";
import { validateEnv } from "./types/context";
import { contextMiddleware } from "./middleware";
import { setupWorkers } from "./workers";
import { report } from "./routes/report";
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
const _ = setupWorkers(connection);

/**
 * Creates report
 */
const createRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests, please try again later.",
});
app.post("/create", createRateLimiter, create);

/**
 * Gets a report
 */
app.get("/report/:reportUri", report);

app.get("/test", async (req, res) => {
  return res.send("hi");
});

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
