import { Queue } from "bullmq";
import IORedis from "ioredis";
import { exit } from "process";

export const connection = new IORedis({
  connectionName: "Express-Pipeline",
  host: "localhost",
  port: 6379,
  maxRetriesPerRequest: null,
});

connection.on("connect", () => {
  console.log("Redis is connected");
});

connection.on("error", () => {
  console.error("Redis connection error");
  exit(1);
});

export const pipelineQueue = new Queue("pipeline", {
  connection,
});
