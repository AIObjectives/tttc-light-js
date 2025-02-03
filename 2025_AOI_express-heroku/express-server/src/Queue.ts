// import { Queue } from "bullmq";
// import IORedis from "ioredis";
// import { exit } from "process";
// import { Env } from "types/context";

// export const setupConnection = (env: Env) => {
//   const connection = new IORedis({
//     connectionName: "Express-Pipeline",
//     host: env.REDIS_HOST,
//     port: env.REDIS_PORT,
//     maxRetriesPerRequest: null,
//   });

//   connection.on("connect", () => {
//     console.log("Redis is connected");
//   });

//   connection.on("error", () => {
//     console.error("Redis connection error");
//     exit(1);
//   });

//   const pipelineQueue = new Queue("pipeline", {
//     connection,
//   });

//   return { connection, pipelineQueue };
// };



// import { Queue } from "bullmq";
// import IORedis from "ioredis";
// import { exit } from "process";
// import { Env } from "types/context";

// export const setupConnection = (env: Env) => {
//   const connection = new IORedis(env.REDIS_URL, {
//     tls: { rejectUnauthorized: false }, // ✅ Required for Heroku Redis
//   });

//   connection.on("connect", () => {
//     console.log("✅ Redis is connected");
//   });

//   connection.on("error", (err) => {
//     console.error("❌ Redis connection error:", err);
//     exit(1);
//   });

//   const pipelineQueue = new Queue("pipeline", {
//     connection,
//   });

//   return { connection, pipelineQueue };
// };




//after the error for bullmq

// import { Queue } from "bullmq";
// import IORedis from "ioredis";
// import { exit } from "process";
// import { Env } from "types/context";

// export const setupConnection = (env: Env) => {
//   const connection = new IORedis(env.REDIS_URL, {
//     connectionName: "Express-Pipeline",
//     tls: env.REDIS_URL.startsWith("rediss://") ? {} : undefined,
//     maxRetriesPerRequest: null,  // Ensure this is explicitly set
//   });

//   connection.on("connect", () => {
//     console.log("✅ Redis is connected");
//   });

//   connection.on("error", (err) => {
//     console.error("❌ Redis connection error:", err);
//     exit(1);
//   });

//   const pipelineQueue = new Queue("pipeline", {
//     connection,
//   });

//   return { connection, pipelineQueue };
// };


// another trial:

// import { Queue } from "bullmq";
// import IORedis from "ioredis";
// import { exit } from "process";
// import { Env } from "types/context";

// export const setupConnection = (env: Env) => {
//   const redisUrl = process.env.REDIS_URL || env.REDIS_URL;

//   if (!redisUrl) {
//     console.error("❌ Missing REDIS_URL environment variable!");
//     exit(1);
//   }

//   const connection = new IORedis(redisUrl, {
//     connectionName: "Express-Pipeline",
//     tls: redisUrl.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined, 
//     maxRetriesPerRequest: null,
//   });




//   connection.on("connect", () => {
//     console.log("✅ Redis is connected");
//   });

//   connection.on("error", (err) => {
//     console.error("❌ Redis connection error:", err);
//     exit(1);
//   });
  

//   const pipelineQueue = new Queue("pipeline", {
//     connection,
//   });

//   return { connection, pipelineQueue };
// };





import { Queue } from "bullmq";
import IORedis from "ioredis";
import { exit } from "process";
import { Env } from "types/context";

export const setupConnection = (env: Env) => {
  const redisUrl = process.env.REDIS_URL || env.REDIS_URL;

  if (!redisUrl) {
    console.error("❌ Missing REDIS_URL environment variable!");
    exit(1);
  }

  const connection = new IORedis(redisUrl, {
    connectionName: "Express-Pipeline",
    tls: redisUrl.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined,
    maxRetriesPerRequest: null,
  });

  connection.on("connect", () => {
    console.log("✅ Redis is connected");
  });

  connection.on("error", (err) => {
    console.error("❌ Redis connection error:", err);
    exit(1);
  });

  const pipelineQueue = new Queue("pipeline", {
    connection,
  });

  return { connection, pipelineQueue };
};

