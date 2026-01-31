process.loadEnvFile(".env");

import http from "node:http";
import { logger } from "tttc-common/logger";
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

    // Start HTTP health check server FIRST for Cloud Run
    // This ensures the port is listening before services initialize
    const port = Number.parseInt(process.env.PORT || "8080", 10);
    const healthServer = http.createServer((req, res) => {
      if (req.url === "/health" || req.url === "/") {
        const status = servicesReady ? 200 : 503;
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: servicesReady ? "healthy" : "starting",
            ready: servicesReady,
            activeMessages: activeMessageCount,
            uptime: process.uptime(),
          }),
        );
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((resolve) => {
      healthServer.listen(port, () => {
        mainLogger.info({ port }, "Health check server listening");
        resolve();
      });
    });

    // Now initialize services (this can take time for health checks)
    mainLogger.info("Initializing services...");
    const services = await initServices(messageTracking);
    servicesReady = true;

    mainLogger.info("Pipeline worker started successfully");

    // Graceful shutdown handler
    const shutdown = async (signal: string) => {
      mainLogger.info(
        { signal, activeMessages: activeMessageCount },
        "Received shutdown signal, closing subscription...",
      );

      // Close health check server
      healthServer.close();

      // Stop accepting new messages
      await services.Queue.close();
      mainLogger.info("Subscription closed, no new messages will be received");

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
    mainLogger.error(
      { error: error instanceof Error ? error : new Error(String(error)) },
      "Failed to start pipeline worker",
    );
    process.exit(1);
  }
}

main().catch((error) => {
  mainLogger.error({ error }, "Unhandled error in main");
  process.exit(1);
});
