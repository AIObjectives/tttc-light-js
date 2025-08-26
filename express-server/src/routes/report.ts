import { Response } from "express";
import { Logger } from "pino";
import { RequestWithLogger } from "../types/request";
import * as api from "tttc-common/api";
import * as utils from "tttc-common/utils";
import { pipelineQueue } from "../server";
import { Bucket, createStorage } from "../storage";
import { sendError } from "./sendError";
import { Result } from "tttc-common/functional-utils";
class BucketParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BucketParseError";
  }
}

function getBucketAndFileName(
  req: RequestWithLogger,
): Result<{ bucket: string; fileName: string }, BucketParseError> {
  const env = req.context.env;
  const uri = decodeURIComponent(
    api.getReportRequestUri.parse(req.params.reportUri),
  );
  const parsed = Bucket.parseUri(uri, env.GCLOUD_STORAGE_BUCKET);
  if (parsed.tag === "failure") {
    req.log.warn({ reportUri: req.params.reportUri }, "Invalid report URI");
    return {
      tag: "failure",
      error: new BucketParseError("Invalid or missing report URI"),
    };
  }
  const { bucket, fileName } = parsed.value;

  if (!env.ALLOWED_GCS_BUCKETS.includes(bucket)) {
    return {
      tag: "failure",
      error: new BucketParseError(`Bucket ${bucket} not in allowed list.`),
    };
  }
  return { tag: "success", value: { bucket, fileName } };
}

export async function getReportStatusHandler(
  req: RequestWithLogger,
  res: Response,
) {
  const parsed = getBucketAndFileName(req);
  switch (parsed.tag) {
    case "success": {
      const { bucket, fileName } = parsed.value;

      const jobState = await pipelineQueue.getJobState(fileName);
      if (jobState === "unknown")
        return res.json({ status: api.reportJobStatus.Values["notFound"] });
      else if (jobState === "completed")
        return res.json({ status: api.reportJobStatus.Values.finished });
      else if (jobState === "failed")
        return res.json({ status: api.reportJobStatus.Values.failed });
      else if (jobState === "waiting")
        return res.json({ status: api.reportJobStatus.Values.queued });
      const job = await pipelineQueue.getJob(fileName);
      const { status } = await job.progress;
      return res.json({ status });
    }
    case "failure":
      req.log.error(
        { reportUri: req.params.reportUri },
        "Invalid or missing report URI",
      );
      sendError(res, 404, "Invalid or missing report URI", "InvalidReportUri");
      return;
    default:
      utils.assertNever(parsed);
  }
}

export async function getReportDataHandler(
  req: RequestWithLogger,
  res: Response,
) {
  const env = req.context.env;
  const parsed = getBucketAndFileName(req);
  switch (parsed.tag) {
    case "success": {
      const { bucket, fileName } = parsed.value;

      try {
        // Try to generate a signed URL first
        const storage = new Bucket(env.GOOGLE_CREDENTIALS_ENCODED, bucket);
        const urlResult = await storage.getUrl(fileName);
        if (urlResult.tag === "failure") {
          req.log.error({ error: urlResult.error }, "Failed to get signed URL");
          sendError(res, 500, urlResult.error.message, "GetUrlError");
          return;
        }
        const url = urlResult.value;
        res.json({ url });
      } catch (e) {
        req.log.error({ error: e }, "Error generating signed URL");
        req.log.warn({ fileName, bucket }, "Falling back to public URL");
        const publicUrl = `https://storage.googleapis.com/${bucket}/${fileName}`;
        try {
          const headRes = await fetch(publicUrl, { method: "HEAD" });
          if (headRes.ok) {
            res.set(
              "X-Deprecation-Warning",
              "Using public URL fallback; please migrate to private bucket.",
            );
            res.json({
              url: publicUrl,
              warning:
                "Using public URL fallback; please migrate to private bucket.",
            });
          } else {
            return sendError(
              res,
              headRes.status,
              `File not found (status: ${headRes.status})`,
              "FileNotFound",
            );
          }
        } catch (err) {
          req.log.error(
            { publicUrl, error: err },
            "Exception during public URL fallback",
          );
          return sendError(res, 404, "File not found", "FileNotFound");
        }
      }
      break;
    }
    case "failure":
      sendError(res, 404, "Invalid or missing report URI", "InvalidReportUri");
      return;
    default:
      utils.assertNever(parsed);
  }
}
