import type * as schema from "tttc-common/schema";
import type { Env } from "../types/context";

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

type FirebaseDetails = {
  reportDataUri: string;
  userId: string;
  firebaseJobId: string;
  reportId?: string;
};

interface PipelineConfig {
  env: Env;
  auth: "public" | "private";
  firebaseDetails: FirebaseDetails;
  llm: { model: string };
  instructions: {
    systemInstructions: string;
    clusteringInstructions: string;
    extractionInstructions: string;
    dedupInstructions: string;
    summariesInstructions: string;
    cruxInstructions: string;
    outputLanguage?: string;
  };
  options: {
    cruxes: boolean;
    bridging: boolean;
    evaluations: boolean;
  };
}

export interface PipelineJob {
  config: PipelineConfig;
  data: schema.SourceRow[];
  reportDetails: {
    title: string;
    description: string;
    question: string;
    filename: string;
  };
}

// Interface for implementing a Queue.
// Used for processing reports
export interface Queue {
  enqueue(item: PipelineJob, options?: EnqueueOptions): Promise<void>; // Adds a job to the queue
  close(): Promise<void>; // Closes the queue connection
}
