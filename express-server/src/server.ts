import "dotenv/config";
import express from "express";
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
app.post("/create", create);

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
