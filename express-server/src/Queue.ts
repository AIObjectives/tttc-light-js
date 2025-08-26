import { Queue } from "bullmq";
import IORedis from "ioredis";
import { exit } from "process";
import { logger } from "tttc-common/logger";
import { Env } from "./types/context";

const queueLogger = logger.child({ module: "queue" });

export const setupConnection = (env: Env) => {
  const connection = new IORedis(env.REDIS_URL, {
    connectionName: "Express-Pipeline",
    maxRetriesPerRequest: null,
    // Add TLS options for Heroku
    // tls: {
    //   rejectUnauthorized: false
    // }
  });

  connection.on("connect", () => {
    queueLogger.info("Redis is connected");
  });

  connection.on("error", (e) => {
    queueLogger.error(
      {
        error: e,
        errorName: e.name,
        errorMessage: e.message,
      },
      "Redis connection error",
    );
    exit(1);
  });

  const pipelineQueue = new Queue(env.REDIS_QUEUE_NAME, {
    connection,
  });

  return { connection, pipelineQueue };
};
