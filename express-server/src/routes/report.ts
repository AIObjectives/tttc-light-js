import { Request, Response } from "express";
import * as api from "tttc-common/api";
import { pipelineQueue } from "../server";
import { Bucket, createStorage } from "../storage";
import { sendError } from "./sendError";

export async function getReportStatusHandler(req: Request, res: Response) {
  const env = req.context.env; // Use env from middleware
  const uri = decodeURIComponent(
    api.getReportRequestUri.parse(req.params.reportUri),
  );
  const fileName = Bucket.extractFileNameFromUri(
    uri,
    env.GCLOUD_STORAGE_BUCKET,
  );
  if (!fileName) {
    return sendError(
      res,
      404,
      "Invalid or missing report URI",
      "InvalidReportUri",
    );
  }
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

export async function getReportDataHandler(req: Request, res: Response) {
  const env = req.context.env; // Use env from middleware
  const uri = decodeURIComponent(
    api.getReportRequestUri.parse(req.params.reportUri),
  );
  const fileName = Bucket.extractFileNameFromUri(
    uri,
    env.GCLOUD_STORAGE_BUCKET,
  );
  if (!fileName) {
    return sendError(
      res,
      404,
      "Invalid or missing report URI",
      "InvalidReportUri",
    );
  }
  try {
    const storage = createStorage(env);
    const url = await storage.getUrl(fileName);
    res.json({ url });
  } catch (e) {
    console.error("Failed to generate signed URL:", e);
    sendError(
      res,
      500,
      "Could not generate a signed URL for the requested report. Please try again later.",
      "SignedUrlError",
    );
  }
}
