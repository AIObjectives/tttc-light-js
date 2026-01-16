import type { PipelineJob } from "../jobs/pipeline";

/**
 * Options for enqueueing a pipeline job
 */
export interface EnqueueOptions {
  /**
   * Request correlation ID for distributed tracing.
   * Propagated via Pub/Sub message attributes for end-to-end request tracking.
   */
  requestId?: string;
}

// Interface for implementing a Queue.
// Used for processing reports
export interface Queue {
  enqueue(item: PipelineJob, options?: EnqueueOptions): Promise<void>; // Adds a job the queue
  listen(): Promise<void>; // Starts listening for jobs in the queue
  close(): Promise<void>; // Closes the queue connection
}
