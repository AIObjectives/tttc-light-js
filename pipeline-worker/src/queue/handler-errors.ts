/**
 * Error types for pipeline job handler
 *
 * These errors support the transient/permanent distinction needed for
 * message retry logic in the queue handler.
 */

/**
 * Base error for queue handler operations
 */
export class HandlerError extends Error {
  constructor(
    message: string,
    public readonly isTransient: boolean,
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
