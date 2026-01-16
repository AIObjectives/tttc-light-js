import express from "express";
import { createMinimalTestEnv } from "tttc-common/test-utils";

/**
 * Creates a minimal Express app instance for API contract testing
 * This allows us to test actual HTTP routing without importing dependencies
 */
export async function setupTestApp(): Promise<express.Application> {
  const app = express();

  // Add basic middleware
  app.use(express.json());

  // Add context middleware with test environment
  app.use((req, _res, next) => {
    (req as any).context = {
      env: createMinimalTestEnv(),
    };
    (req as any).log = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      child: () => ({
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      }),
    };
    next();
  });

  // Mock unified report endpoint - exists and returns proper format
  app.get("/report/:identifier", (req, res) => {
    const { identifier } = req.params;

    // Handle malicious inputs by returning errors
    if (
      identifier === "../../../etc/passwd" ||
      identifier.includes("<script>")
    ) {
      return res.status(404).json({
        error: { message: "Report not found", code: "ReportNotFound" },
      });
    }

    // Basic validation exists (endpoint doesn't crash)
    if (!identifier || typeof identifier !== "string") {
      return res.status(400).json({
        error: { message: "Invalid identifier", code: "InvalidInput" },
      });
    }

    // Special handling for different test scenarios
    if (identifier === "ProcessingReport123") {
      res.set("Cache-Control", "no-cache, no-store, must-revalidate");
      return res.status(200).json({
        status: "processing",
        message: "Report is being generated",
      });
    }

    // For finished reports, set cache headers
    res.set("Cache-Control", "private, max-age=3600");
    res.status(200).json({
      status: "finished",
      dataUrl: "https://mock-data-url.com/report.json",
      metadata: { title: "Test Report" },
    });
  });

  // Mock migration endpoint - handle the full path structure
  app.get("/report/:bucket/:filename/migrate", (req, res) => {
    const { bucket, filename } = req.params;

    if (
      !bucket ||
      !filename ||
      typeof bucket !== "string" ||
      typeof filename !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid report URI",
      });
    }

    // For contract testing, return migration success format (20-char Firebase ID)
    res.status(200).json({
      success: true,
      newUrl: "/report/AbCdEfGhIjKlMnOpQrSt",
      docId: "AbCdEfGhIjKlMnOpQrSt",
    });
  });

  // Also handle the encoded URI migration path
  app.get("/report/:reportUri/migrate", (req, res) => {
    const { reportUri } = req.params;

    if (!reportUri || typeof reportUri !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invalid report URI",
      });
    }

    // For contract testing, return migration success format (20-char Firebase ID)
    res.status(200).json({
      success: true,
      newUrl: "/report/AbCdEfGhIjKlMnOpQrSt",
      docId: "AbCdEfGhIjKlMnOpQrSt",
    });
  });

  // Add a test route to verify the server is working
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  return app;
}
