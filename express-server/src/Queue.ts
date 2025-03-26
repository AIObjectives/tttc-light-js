import { Queue } from "bullmq";
import IORedis from "ioredis";
import { exit } from "process";
import { Env } from "./types/context";

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
    console.log("Redis is connected");
  });

  connection.on("error", (e) => {
    console.error("Redis connection error: ", e.name, e.message);
    exit(1);
  });

  const pipelineQueue = new Queue("pipeline", {
    connection,
  });

  return { connection, pipelineQueue };
};
