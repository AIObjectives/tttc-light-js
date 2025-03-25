import { Request, Response } from "express";
import * as api from "tttc-common/api";
import { pipelineQueue } from "../server";

export async function report(req: Request, res: Response) {
  const uri = decodeURIComponent(
    api.getReportRequestUri.parse(req.params.reportUri),
  );
  // Extract name of the json file
  const name = new URL(uri).pathname.split("/").pop();
  // If no such name exists, then we can't find the resource.
  if (!name) {
    res.status(404).send("Not Found");
    return;
  }
  const jobState = await pipelineQueue.getJobState(name);
  if (jobState === "unknown")
    return res.send({ status: api.reportJobStatus.Values["notFound"] });
  else if (jobState === "completed")
    return res.send({ status: api.reportJobStatus.Values.finished });
  else if (jobState === "failed")
    return res.send({ status: api.reportJobStatus.Values.failed });
  else if (jobState === "waiting")
    return res.send({ status: api.reportJobStatus.Values.queued });
  const job = await pipelineQueue.getJob(name);
  const { status } = await job.progress;
  return res.send({
    status,
  });
}
