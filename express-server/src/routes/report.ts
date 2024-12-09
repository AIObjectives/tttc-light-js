import { Request, Response } from "express";
import * as api from "tttc-common/api";
import { pipelineQueue } from "../Queue";

export async function report(req: Request, res: Response) {
  const uri = decodeURIComponent(
    api.getReportRequestUri.parse(req.params.reportUri),
  );
  const name = new URL(uri).pathname.split("/").pop();
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
