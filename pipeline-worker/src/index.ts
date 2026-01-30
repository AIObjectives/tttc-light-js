process.loadEnvFile(".env");

import { logger } from "tttc-common/logger";
import { initServices } from "./services";

const mainLogger = logger.child({ module: "main" });

async function main() {
  try {
    mainLogger.info("Starting pipeline worker...");

    const services = await initServices();

    mainLogger.info("Pipeline worker started successfully");

    // Track active message processing for graceful shutdown
    let activeMessageCount = 0;
    const incrementActive = () => activeMessageCount++;
    const decrementActive = () => activeMessageCount--;

    // Graceful shutdown handler
    const shutdown = async (signal: string) => {
      mainLogger.info(
        { signal, activeMessages: activeMessageCount },
        "Received shutdown signal, closing subscription...",
      );

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

    // Export helpers for message tracking (used by queue handler)
    (global as any).__incrementActiveMessages = incrementActive;
    (global as any).__decrementActiveMessages = decrementActive;
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
