import { Queue } from "bullmq";
import IORedis from "ioredis";
import { exit } from "process";
import { Env } from "types/context";

export const setupConnection = (env: Env) => {
  const connection = new IORedis({
    connectionName: "Express-Pipeline",
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    maxRetriesPerRequest: null,
  });

  connection.on("connect", () => {
    console.log("Redis is connected");
  });

  connection.on("error", () => {
    console.error("Redis connection error");
    exit(1);
  });

  const pipelineQueue = new Queue("pipeline", {
    connection,
  });

  return { connection, pipelineQueue };
};
