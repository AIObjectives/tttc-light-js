import type { PipelineJob } from "../jobs/pipeline";

// Interface for implementing a Queue.
// Used for processing reports
export interface Queue {
  enqueue(item: PipelineJob): Promise<void>; // Adds a job the queue
  listen(): Promise<void>; // Starts listening for jobs in the queue
  close(): Promise<void>; // Closes the queue connection
}
