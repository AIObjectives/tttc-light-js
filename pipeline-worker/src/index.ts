// Load .env file in development (Cloud Run injects env vars directly)
import { existsSync } from "node:fs";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

import http from "node:http";
import { logger } from "tttc-common/logger";
import { pipelineJobSchema } from "tttc-common/schema";
import { initServices } from "./services";

const mainLogger = logger.child({ module: "main" });

async function main() {
  try {
    mainLogger.info("Starting pipeline worker...");

    // Track active message processing for graceful shutdown
    let activeMessageCount = 0;
    let servicesReady = false;
    const messageTracking = {
      onMessageStart: () => {
        activeMessageCount++;
      },
      onMessageEnd: () => {
        activeMessageCount--;
      },
    };

    // Check if we should use push or pull mode
    const usePushSubscription = process.env.PUBSUB_PUSH_ENABLED === "true";
    mainLogger.info(
      { mode: usePushSubscription ? "push" : "pull" },
      "Starting pipeline worker in subscription mode",
    );

    // Start HTTP server for health checks AND push subscriptions
    const port = Number.parseInt(process.env.PORT || "8080", 10);

    // Initialize services early so we can handle push messages
    mainLogger.info("Initializing services...");
    const services = await initServices(messageTracking, usePushSubscription);
    servicesReady = true;

    const healthServer = http.createServer(async (req, res) => {
      // Health check endpoint
      if (req.url === "/health" || req.url === "/") {
        const status = servicesReady ? 200 : 503;
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: servicesReady ? "healthy" : "starting",
            ready: servicesReady,
            activeMessages: activeMessageCount,
            uptime: process.uptime(),
            mode: usePushSubscription ? "push" : "pull",
          }),
        );
        return;
      }

      // Push subscription endpoint
      if (req.url === "/pubsub/push" && req.method === "POST") {
        if (!servicesReady) {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Service not ready" }));
          return;
        }

        messageTracking.onMessageStart();

        try {
          // Read the request body
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(chunk);
          }
          const body = Buffer.concat(chunks).toString("utf-8");

          // Parse Pub/Sub push message format
          const pushMessage = JSON.parse(body);
          const messageData = Buffer.from(
            pushMessage.message.data,
            "base64",
          ).toString("utf-8");
          const jobData = JSON.parse(messageData);

          // Validate against schema
          const validatedJob = pipelineJobSchema.parse(jobData);

          // Process the message using the push handler
          await services.handlePushMessage({
            id: pushMessage.message.messageId,
            data: validatedJob,
            attributes: pushMessage.message.attributes || {},
            publishTime: new Date(pushMessage.message.publishTime),
          });

          // Acknowledge the message
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          mainLogger.error(
            { error, url: req.url },
            "Error processing push message",
          );
          // Return 4xx for permanent errors (don't retry)
          // Return 5xx for transient errors (Pub/Sub will retry)
          const isTransient =
            error instanceof Error &&
            (error.message.includes("timeout") ||
              error.message.includes("connection") ||
              error.message.includes("ECONNREFUSED"));

          const statusCode = isTransient ? 500 : 400;
          res.writeHead(statusCode, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        } finally {
          messageTracking.onMessageEnd();
        }
        return;
      }

      // 404 for unknown routes
      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => {
      healthServer.listen(port, () => {
        mainLogger.info({ port }, "HTTP server listening");
        resolve();
      });
    });

    mainLogger.info("Pipeline worker started successfully");

    // Graceful shutdown handler
    const shutdown = async (signal: string) => {
      mainLogger.info(
        { signal, activeMessages: activeMessageCount },
        "Received shutdown signal, closing subscription...",
      );

      // Close health check server
      healthServer.close();

      // Stop accepting new messages (only for pull mode)
      if (services.Queue) {
        await services.Queue.close();
        mainLogger.info(
          "Subscription closed, no new messages will be received",
        );
      } else {
        mainLogger.info(
          "Push mode - HTTP server closed, no new messages will be received",
        );
      }

      // Wait for active messages to complete (with timeout)
      const shutdownTimeout = 30000; // 30 seconds for graceful shutdown
      const startTime = Date.now();

      while (activeMessageCount > 0) {
        const elapsed = Date.now() - startTime;
        if (elapsed > shutdownTimeout) {
          mainLogger.warn(
            { activeMessages: activeMessageCount },
            "Shutdown timeout reached, exiting with active messages",
          );
          break;
        }

        mainLogger.info(
          { activeMessages: activeMessageCount, elapsed },
          "Waiting for active messages to complete...",
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      mainLogger.info("Graceful shutdown complete");
      process.exit(0);
    };

    // Keep process alive
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    const errorDetails =
      error instanceof Error
        ? {
            message: error.message,
            name: error.name,
            stack: error.stack,
            cause: error.cause,
          }
        : { message: String(error) };

    mainLogger.error(
      {
        error: errorDetails,
        env: {
          PUBSUB_TOPIC: process.env.PUBSUB_TOPIC,
          PUBSUB_SUBSCRIPTION: process.env.PUBSUB_SUBSCRIPTION,
          GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
          NODE_ENV: process.env.NODE_ENV,
        },
      },
      "Failed to start pipeline worker",
    );
    process.exit(1);
  }
}

main().catch((error) => {
  mainLogger.error({ error }, "Unhandled error in main");
  process.exit(1);
});
