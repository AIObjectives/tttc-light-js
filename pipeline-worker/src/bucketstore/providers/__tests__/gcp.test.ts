import { Storage } from "@google-cloud/storage";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { UploadFailedError } from "../../types";
import { GCPBucketStore } from "../gcp";

/**
 * Mock the @google-cloud/storage module
 *
 * This mock provides a complete implementation of the Storage API
 * that we need for testing, including bucket(), file(), and save() methods.
 */
vi.mock("@google-cloud/storage", () => {
  const mockSave = vi.fn();
  const mockFile = vi.fn(() => ({
    save: mockSave,
  }));
  const mockBucket = vi.fn(() => ({
    file: mockFile,
  }));
  const MockStorage = vi.fn(() => ({
    bucket: mockBucket,
  }));

  return {
    Storage: MockStorage,
  };
});

describe("GCPBucketStore", () => {
  let bucketStore: GCPBucketStore;
  let mockStorage: any;
  let mockBucket: Mock;
  let mockFile: Mock;
  let mockSave: Mock;

  /**
   * Before each test, we need to:
   * 1. Clear all mocks to ensure test isolation
   * 2. Get fresh references to the mocked functions
   * 3. Create a new instance of GCPBucketStore
   */
  beforeEach(() => {
    vi.clearAllMocks();

    // Get the mocked Storage constructor and its chain of methods
    const StorageConstructor = Storage as unknown as Mock;
    mockStorage = new StorageConstructor();
    mockBucket = mockStorage.bucket;
    const bucketInstance = mockBucket();
    mockFile = bucketInstance.file;
    const fileInstance = mockFile();
    mockSave = fileInstance.save;

    // Create a new instance for each test
    bucketStore = new GCPBucketStore("test-bucket");
  });

  describe("Constructor", () => {
    it("should create instance with bucketName only", () => {
      const store = new GCPBucketStore("my-bucket");

      expect(store).toBeInstanceOf(GCPBucketStore);
      expect(Storage).toHaveBeenCalledWith({});
    });

    it("should create instance with bucketName and projectId", () => {
      const store = new GCPBucketStore("my-bucket", "my-project-id");

      expect(store).toBeInstanceOf(GCPBucketStore);
      expect(Storage).toHaveBeenCalledWith({ projectId: "my-project-id" });
    });

    it("should initialize Storage with empty config when projectId is not provided", () => {
      vi.clearAllMocks();
      const _store = new GCPBucketStore("my-bucket");

      expect(Storage).toHaveBeenCalledWith({});
      expect(Storage).toHaveBeenCalledTimes(1);
    });

    it("should initialize Storage with projectId config when provided", () => {
      vi.clearAllMocks();
      const _store = new GCPBucketStore("my-bucket", "test-project-123");

      expect(Storage).toHaveBeenCalledWith({ projectId: "test-project-123" });
      expect(Storage).toHaveBeenCalledTimes(1);
    });
  });

  describe("storeFile - Success Scenarios", () => {
    it("should successfully upload file and return correct URL", async () => {
      mockSave.mockResolvedValue(undefined);

      const url = await bucketStore.storeFile(
        "test-file.json",
        '{"key": "value"}',
      );

      expect(url).toBe(
        "https://storage.googleapis.com/test-bucket/test-file.json",
      );
    });

    it("should call bucket() with correct bucket name", async () => {
      mockSave.mockResolvedValue(undefined);
      mockBucket.mockClear();

      await bucketStore.storeFile("test-file.json", '{"key": "value"}');

      expect(mockBucket).toHaveBeenCalledWith("test-bucket");
      expect(mockBucket).toHaveBeenCalledTimes(1);
    });

    it("should call file() with correct file name", async () => {
      mockSave.mockResolvedValue(undefined);
      mockFile.mockClear();

      await bucketStore.storeFile("my-data.json", '{"data": 123}');

      expect(mockFile).toHaveBeenCalledWith("my-data.json");
      expect(mockFile).toHaveBeenCalledTimes(1);
    });

    it("should call save() with correct content and metadata", async () => {
      mockSave.mockResolvedValue(undefined);

      const fileContent = '{"test": "data"}';
      await bucketStore.storeFile("test.json", fileContent);

      expect(mockSave).toHaveBeenCalledWith(fileContent, {
        metadata: {
          contentType: "application/json",
        },
      });
      expect(mockSave).toHaveBeenCalledTimes(1);
    });

    it("should set contentType to application/json", async () => {
      mockSave.mockResolvedValue(undefined);

      await bucketStore.storeFile("test.json", "{}");

      const saveCall = mockSave.mock.calls[0];
      expect(saveCall[1].metadata.contentType).toBe("application/json");
    });

    it("should handle file names with special characters", async () => {
      mockSave.mockResolvedValue(undefined);

      const fileName = "reports/2024/data-file_v1.2.json";
      const url = await bucketStore.storeFile(fileName, "{}");

      expect(mockFile).toHaveBeenCalledWith(fileName);
      expect(url).toBe(
        `https://storage.googleapis.com/test-bucket/${fileName}`,
      );
    });

    it("should handle empty file content", async () => {
      mockSave.mockResolvedValue(undefined);

      const url = await bucketStore.storeFile("empty.json", "");

      expect(mockSave).toHaveBeenCalledWith("", {
        metadata: {
          contentType: "application/json",
        },
      });
      expect(url).toBe("https://storage.googleapis.com/test-bucket/empty.json");
    });

    it("should handle large file content", async () => {
      mockSave.mockResolvedValue(undefined);

      const largeContent = JSON.stringify({ data: "x".repeat(10000) });
      const url = await bucketStore.storeFile("large.json", largeContent);

      expect(mockSave).toHaveBeenCalledWith(largeContent, {
        metadata: {
          contentType: "application/json",
        },
      });
      expect(url).toBe("https://storage.googleapis.com/test-bucket/large.json");
    });

    it("should generate URL with correct format", async () => {
      mockSave.mockResolvedValue(undefined);

      const url = await bucketStore.storeFile("path/to/file.json", "{}");

      expect(url).toMatch(/^https:\/\/storage\.googleapis\.com\/[^/]+\/.+$/);
      expect(url).toContain("test-bucket");
      expect(url).toContain("path/to/file.json");
    });
  });

  describe("storeFile - Error Scenarios", () => {
    it("should throw UploadFailedError when upload fails with Error instance", async () => {
      const uploadError = new Error("Network timeout");
      mockSave.mockRejectedValue(uploadError);

      await expect(bucketStore.storeFile("test.json", "{}")).rejects.toThrow(
        UploadFailedError,
      );

      try {
        await bucketStore.storeFile("test.json", "{}");
      } catch (error) {
        expect(error).toBeInstanceOf(UploadFailedError);
        if (error instanceof UploadFailedError) {
          expect(error.fileName).toBe("test.json");
          expect(error.reason).toBe("Network timeout");
        }
      }
    });

    it("should throw UploadFailedError when upload fails with string error", async () => {
      mockSave.mockRejectedValue("Connection refused");

      await expect(bucketStore.storeFile("file.json", "{}")).rejects.toThrow(
        UploadFailedError,
      );

      try {
        await bucketStore.storeFile("file.json", "{}");
      } catch (error) {
        expect(error).toBeInstanceOf(UploadFailedError);
        if (error instanceof UploadFailedError) {
          expect(error.fileName).toBe("file.json");
          expect(error.reason).toBe("Connection refused");
        }
      }
    });

    it("should handle non-Error object thrown during upload", async () => {
      mockSave.mockRejectedValue({ code: 500, message: "Internal error" });

      await expect(bucketStore.storeFile("test.json", "{}")).rejects.toThrow(
        UploadFailedError,
      );

      try {
        await bucketStore.storeFile("test.json", "{}");
      } catch (error) {
        expect(error).toBeInstanceOf(UploadFailedError);
        if (error instanceof UploadFailedError) {
          expect(error.fileName).toBe("test.json");
          // Should extract the message property from the error object
          expect(error.reason).toBe("Internal error");
        }
      }
    });

    it("should include correct fileName in error when upload fails", async () => {
      mockSave.mockRejectedValue(new Error("Upload failed"));

      const fileName = "specific-file.json";

      try {
        await bucketStore.storeFile(fileName, "{}");
      } catch (error) {
        if (error instanceof UploadFailedError) {
          expect(error.fileName).toBe(fileName);
        }
      }
    });

    it("should handle error with null message", async () => {
      const errorWithNull = new Error();
      errorWithNull.message = null as any;
      mockSave.mockRejectedValue(errorWithNull);

      await expect(bucketStore.storeFile("test.json", "{}")).rejects.toThrow(
        UploadFailedError,
      );
    });

    it("should handle permission denied error", async () => {
      const permissionError = new Error(
        "Permission denied: Insufficient permissions",
      );
      mockSave.mockRejectedValue(permissionError);

      try {
        await bucketStore.storeFile("test.json", "{}");
      } catch (error) {
        expect(error).toBeInstanceOf(UploadFailedError);
        if (error instanceof UploadFailedError) {
          expect(error.reason).toContain("Permission denied");
        }
      }
    });

    it("should handle bucket not found error", async () => {
      const bucketError = new Error("Bucket does not exist");
      mockSave.mockRejectedValue(bucketError);

      try {
        await bucketStore.storeFile("test.json", "{}");
      } catch (error) {
        expect(error).toBeInstanceOf(UploadFailedError);
        if (error instanceof UploadFailedError) {
          expect(error.reason).toBe("Bucket does not exist");
        }
      }
    });

    it("should handle quota exceeded error", async () => {
      const quotaError = new Error("Quota exceeded for this project");
      mockSave.mockRejectedValue(quotaError);

      try {
        await bucketStore.storeFile("test.json", "{}");
      } catch (error) {
        expect(error).toBeInstanceOf(UploadFailedError);
        if (error instanceof UploadFailedError) {
          expect(error.reason).toContain("Quota exceeded");
        }
      }
    });
  });

  describe("Integration Scenarios", () => {
    it("should handle multiple sequential uploads", async () => {
      mockSave.mockResolvedValue(undefined);

      const url1 = await bucketStore.storeFile("file1.json", "{}");
      const url2 = await bucketStore.storeFile("file2.json", "{}");
      const url3 = await bucketStore.storeFile("file3.json", "{}");

      expect(url1).toBe(
        "https://storage.googleapis.com/test-bucket/file1.json",
      );
      expect(url2).toBe(
        "https://storage.googleapis.com/test-bucket/file2.json",
      );
      expect(url3).toBe(
        "https://storage.googleapis.com/test-bucket/file3.json",
      );
      expect(mockSave).toHaveBeenCalledTimes(3);
    });

    it("should handle mixture of successful and failed uploads", async () => {
      mockSave
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Failed"))
        .mockResolvedValueOnce(undefined);

      const url1 = await bucketStore.storeFile("file1.json", "{}");
      expect(url1).toBe(
        "https://storage.googleapis.com/test-bucket/file1.json",
      );

      await expect(bucketStore.storeFile("file2.json", "{}")).rejects.toThrow(
        UploadFailedError,
      );

      const url3 = await bucketStore.storeFile("file3.json", "{}");
      expect(url3).toBe(
        "https://storage.googleapis.com/test-bucket/file3.json",
      );
    });

    it("should maintain bucket name across multiple operations", async () => {
      mockSave.mockResolvedValue(undefined);
      mockBucket.mockClear();

      await bucketStore.storeFile("file1.json", "{}");
      await bucketStore.storeFile("file2.json", "{}");

      expect(mockBucket).toHaveBeenCalledWith("test-bucket");
      expect(mockBucket).toHaveBeenCalledTimes(2);
    });

    it("should work correctly with different bucket instances", async () => {
      mockSave.mockResolvedValue(undefined);

      const store1 = new GCPBucketStore("bucket-1");
      const store2 = new GCPBucketStore("bucket-2");

      await store1.storeFile("file.json", "{}");
      await store2.storeFile("file.json", "{}");

      // Both should have been called with their respective bucket names
      const bucketCalls = mockBucket.mock.calls;
      expect(bucketCalls).toContainEqual(["bucket-1"]);
      expect(bucketCalls).toContainEqual(["bucket-2"]);
    });

    it("should handle concurrent uploads to same bucket", async () => {
      mockSave.mockResolvedValue(undefined);

      const promises = [
        bucketStore.storeFile("file1.json", "{}"),
        bucketStore.storeFile("file2.json", "{}"),
        bucketStore.storeFile("file3.json", "{}"),
      ];

      const results = await Promise.all(promises);

      expect(results).toEqual([
        "https://storage.googleapis.com/test-bucket/file1.json",
        "https://storage.googleapis.com/test-bucket/file2.json",
        "https://storage.googleapis.com/test-bucket/file3.json",
      ]);
      expect(mockSave).toHaveBeenCalledTimes(3);
    });
  });

  describe("Edge Cases", () => {
    it("should handle file names with spaces", async () => {
      mockSave.mockResolvedValue(undefined);

      const fileName = "file with spaces.json";
      const url = await bucketStore.storeFile(fileName, "{}");

      expect(mockFile).toHaveBeenCalledWith(fileName);
      expect(url).toContain("file with spaces.json");
    });

    it("should handle file names with unicode characters", async () => {
      mockSave.mockResolvedValue(undefined);

      const fileName = "файл-данных-文件.json";
      const url = await bucketStore.storeFile(fileName, "{}");

      expect(mockFile).toHaveBeenCalledWith(fileName);
      expect(url).toBe(
        `https://storage.googleapis.com/test-bucket/${fileName}`,
      );
    });

    it("should handle very long file names", async () => {
      mockSave.mockResolvedValue(undefined);

      const longFileName = `${"a".repeat(500)}.json`;
      const url = await bucketStore.storeFile(longFileName, "{}");

      expect(mockFile).toHaveBeenCalledWith(longFileName);
      expect(url).toBe(
        `https://storage.googleapis.com/test-bucket/${longFileName}`,
      );
    });

    it("should handle file content with special JSON characters", async () => {
      mockSave.mockResolvedValue(undefined);

      const content = '{"text": "Hello \\"world\\"\\n\\t"}';
      const url = await bucketStore.storeFile("test.json", content);

      expect(mockSave).toHaveBeenCalledWith(content, expect.any(Object));
      expect(url).toBe("https://storage.googleapis.com/test-bucket/test.json");
    });

    it("should handle nested file paths", async () => {
      mockSave.mockResolvedValue(undefined);

      const fileName = "a/b/c/d/e/file.json";
      const url = await bucketStore.storeFile(fileName, "{}");

      expect(url).toBe(
        "https://storage.googleapis.com/test-bucket/a/b/c/d/e/file.json",
      );
    });

    it("should handle file names with multiple dots", async () => {
      mockSave.mockResolvedValue(undefined);

      const fileName = "data.backup.v2.0.json";
      const url = await bucketStore.storeFile(fileName, "{}");

      expect(mockFile).toHaveBeenCalledWith(fileName);
      expect(url).toBe(
        `https://storage.googleapis.com/test-bucket/${fileName}`,
      );
    });

    it("should handle bucket name with hyphens", async () => {
      mockSave.mockResolvedValue(undefined);

      const store = new GCPBucketStore("my-test-bucket-123");
      const url = await store.storeFile("file.json", "{}");

      expect(url).toContain("my-test-bucket-123");
    });
  });

  describe("Error Type Verification", () => {
    it("should return string type on successful upload", async () => {
      mockSave.mockResolvedValue(undefined);

      const url = await bucketStore.storeFile("test.json", "{}");

      expect(typeof url).toBe("string");
      expect(url).toBeTruthy();
    });

    it("should throw UploadFailedError with correct properties on upload error", async () => {
      mockSave.mockRejectedValue(new Error("Test error"));

      try {
        await bucketStore.storeFile("test.json", "{}");
        // If we reach here, the test should fail
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(UploadFailedError);
        if (error instanceof UploadFailedError) {
          expect(error.fileName).toBe("test.json");
          expect(error.reason).toBe("Test error");
          expect(error.name).toBe("UploadFailedError");
        }
      }
    });

    it("should have correct error structure on failure", async () => {
      mockSave.mockRejectedValue(new Error("Upload error"));

      try {
        await bucketStore.storeFile("test.json", "{}");
      } catch (error) {
        expect(error).toMatchObject({
          name: "UploadFailedError",
          fileName: "test.json",
          reason: expect.any(String),
        });
      }
    });
  });

  describe("Error Formatting", () => {
    it("should extract message property from error objects", async () => {
      mockSave.mockRejectedValue({ code: 500, message: "Internal error" });

      try {
        await bucketStore.storeFile("test.json", "{}");
      } catch (error) {
        if (error instanceof UploadFailedError) {
          expect(error.reason).toBe("Internal error");
        }
      }
    });

    it("should extract error property from error objects", async () => {
      mockSave.mockRejectedValue({ error: "Something went wrong" });

      try {
        await bucketStore.storeFile("test.json", "{}");
      } catch (error) {
        if (error instanceof UploadFailedError) {
          expect(error.reason).toBe("Something went wrong");
        }
      }
    });

    it("should format code with msg property", async () => {
      mockSave.mockRejectedValue({
        code: "PERMISSION_DENIED",
        msg: "Access denied",
      });

      try {
        await bucketStore.storeFile("test.json", "{}");
      } catch (error) {
        if (error instanceof UploadFailedError) {
          expect(error.reason).toBe("PERMISSION_DENIED: Access denied");
        }
      }
    });

    it("should use code alone if no message available", async () => {
      mockSave.mockRejectedValue({ code: 403 });

      try {
        await bucketStore.storeFile("test.json", "{}");
      } catch (error) {
        if (error instanceof UploadFailedError) {
          expect(error.reason).toBe("403");
        }
      }
    });

    it("should JSON stringify objects without standard error properties", async () => {
      mockSave.mockRejectedValue({ status: "failed", details: "timeout" });

      try {
        await bucketStore.storeFile("test.json", "{}");
      } catch (error) {
        if (error instanceof UploadFailedError) {
          expect(error.reason).toBe('{"status":"failed","details":"timeout"}');
        }
      }
    });

    it("should handle empty objects as JSON", async () => {
      mockSave.mockRejectedValue({});

      try {
        await bucketStore.storeFile("test.json", "{}");
      } catch (error) {
        if (error instanceof UploadFailedError) {
          // Empty objects are stringified as "{}" instead of "[object Object]"
          expect(error.reason).toBe("{}");
        }
      }
    });

    it("should handle null error gracefully", async () => {
      mockSave.mockRejectedValue(null);

      try {
        await bucketStore.storeFile("test.json", "{}");
      } catch (error) {
        if (error instanceof UploadFailedError) {
          expect(error.reason).toBe("Unknown error");
        }
      }
    });

    it("should handle undefined error gracefully", async () => {
      mockSave.mockRejectedValue(undefined);

      try {
        await bucketStore.storeFile("test.json", "{}");
      } catch (error) {
        if (error instanceof UploadFailedError) {
          expect(error.reason).toBe("Unknown error");
        }
      }
    });

    it("should handle number errors", async () => {
      mockSave.mockRejectedValue(404);

      try {
        await bucketStore.storeFile("test.json", "{}");
      } catch (error) {
        if (error instanceof UploadFailedError) {
          expect(error.reason).toBe("404");
        }
      }
    });

    it("should prefer message over other properties", async () => {
      mockSave.mockRejectedValue({
        message: "Main message",
        error: "Secondary error",
        code: 500,
      });

      try {
        await bucketStore.storeFile("test.json", "{}");
      } catch (error) {
        if (error instanceof UploadFailedError) {
          expect(error.reason).toBe("Main message");
        }
      }
    });
  });
});
