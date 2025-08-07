import { HttpError } from "http-errors";

/**
 * HTTP error interface with status code
 * Using the standard HttpError from @types/http-errors for better type safety
 * Additional data can be stored using the built-in [key: string]: any indexer
 */
export type APIError = HttpError;

/**
 * Type guard to check if an error is an HTTP error with status code
 */
export function isAPIError(error: unknown): error is APIError {
  return (
    error instanceof Error &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
  );
}
