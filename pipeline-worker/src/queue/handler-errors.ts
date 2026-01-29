/**
 * Error types for pipeline job handler
 *
 * These errors support the transient/permanent distinction needed for
 * message retry logic in the queue handler.
 */

/**
 * Error category for better classification and monitoring
 */
export enum ErrorCategory {
  /** Invalid input data or configuration */
  VALIDATION = "validation",
  /** Infrastructure failures (GCS, Firestore, Redis) */
  INFRASTRUCTURE = "infrastructure",
  /** Pipeline processing failures (LLM, pipeline logic) */
  PIPELINE = "pipeline",
  /** Lock acquisition or extension failures */
  CONCURRENCY = "concurrency",
  /** Unclassified errors */
  UNKNOWN = "unknown",
}

/**
 * Base error for queue handler operations
 */
export class HandlerError extends Error {
  constructor(
    message: string,
    public readonly isTransient: boolean,
    public readonly category: ErrorCategory = ErrorCategory.UNKNOWN,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "HandlerError";
  }
}

/**
 * Configuration or data validation error (always permanent)
 */
export class ValidationError extends Error {
  public readonly isTransient = false;

  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Storage operation error (can be transient or permanent)
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly isTransient: boolean,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "StorageError";
  }
}
