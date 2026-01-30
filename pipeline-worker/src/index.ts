process.loadEnvFile(".env");

import { logger } from "tttc-common/logger";
import { initServices } from "./services";

const mainLogger = logger.child({ module: "main" });

async function main() {
  try {
    mainLogger.info("Starting pipeline worker...");

    const services = await initServices();

    mainLogger.info("Pipeline worker started successfully");

    // Keep process alive
    process.on("SIGINT", async () => {
      mainLogger.info("Received SIGINT, shutting down gracefully...");
      await services.Queue.close();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      mainLogger.info("Received SIGTERM, shutting down gracefully...");
      await services.Queue.close();
      process.exit(0);
    });
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
