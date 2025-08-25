// import {z} from "zod";
import { handlePipelineStep } from "../handlePipelineStep";
import { FetchError, InvalidResponseDataError } from "../errors";
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { Result } from "tttc-common/functional-utils";

// Create a schema for testing - simple {status: boolean} as requested
const testSchema = z.object({
  status: z.boolean(),
});
// Type guard functions
function isSuccess<T, E>(
  result: Result<T, E>,
): result is { tag: "success"; value: T } {
  return result.tag === "success";
}

function isFailure<T, E>(
  result: Result<T, E>,
): result is { tag: "failure"; error: E } {
  return result.tag === "failure";
}

// Type for our expected successful result
type TestSchemaType = z.infer<typeof testSchema>;

describe("handlePipelineStep", () => {
  it("should successfully parse valid response data", async () => {
    // Mock a successful response with valid data
    const mockCall = () =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: true }),
      } as Response);

    const result = await handlePipelineStep(testSchema, mockCall);

    expect(result.tag).toBe("success");

    // Type narrowing using type guard
    if (isSuccess<TestSchemaType, any>(result)) {
      expect(result.value).toEqual({ status: true });
    } else {
      // This will fail the test if we don't have a success
      expect.fail("Expected a success result but got failure");
    }
  });

  it("should handle fetch errors", async () => {
    // Mock a failed fetch
    const mockError = new Error("Network error");
    const mockCall = () => Promise.reject(mockError);

    const result = await handlePipelineStep(testSchema, mockCall);

    expect(result.tag).toBe("failure");

    // Type narrowing
    if (isFailure<any, FetchError | InvalidResponseDataError>(result)) {
      expect(result.error).toBeInstanceOf(FetchError);
    } else {
      expect.fail("Expected a failure result but got success");
    }
  });

  it("should handle non-ok response", async () => {
    // Mock a response with non-ok status
    const errorData = { message: "Server error" };
    const mockCall = () =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve(errorData),
      } as Response);

    const result = await handlePipelineStep(testSchema, mockCall);

    expect(result.tag).toBe("failure");

    // Type narrowing
    if (isFailure<any, FetchError | InvalidResponseDataError>(result)) {
      expect(result.error).toBeInstanceOf(FetchError);
    } else {
      expect.fail("Expected a failure result but got success");
    }
  });

  it("should handle malformed data", async () => {
    // Mock a successful response but with invalid data format
    const mockCall = () =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            // Missing 'status' field or wrong type that won't match schema
            wrongField: "not a boolean",
          }),
      } as Response);

    const result = await handlePipelineStep(testSchema, mockCall);

    expect(result.tag).toBe("failure");

    // Type narrowing
    if (isFailure<any, InvalidResponseDataError | FetchError>(result)) {
      expect(result.error).toBeInstanceOf(InvalidResponseDataError);
      // Optionally check the validation error details if exposed
      // expect(result.error.validationError).toBeDefined();
    } else {
      expect.fail("Expected a failure result but got success");
    }
  });
});
