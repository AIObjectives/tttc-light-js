import { Storage } from "@google-cloud/storage";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { DeleteFailedError, UploadFailedError } from "../../types";
import { GCPBucketStore } from "../gcp";

/**
 * Type definitions for mocked Google Cloud Storage objects
 */
interface MockFileInstance {
  save: Mock;
  exists: Mock;
  delete: Mock;
  move: Mock;
  getMetadata: Mock;
}

interface MockBucketInstance {
  file: Mock;
}

interface MockStorageInstance {
  bucket: Mock;
}

/**
 * Mock the @google-cloud/storage module
 *
 * This mock provides a complete implementation of the Storage API
 * that we need for testing, including bucket(), file(), save(), exists(), and delete() methods.
 */
vi.mock("@google-cloud/storage", () => {
  const mockSave = vi.fn();
  const mockExists = vi.fn();
  const mockDelete = vi.fn();
  const mockMove = vi.fn();
  const mockGetMetadata = vi.fn();
  const mockFile = vi.fn(() => ({
    save: mockSave,
    exists: mockExists,
    delete: mockDelete,
    move: mockMove,
    getMetadata: mockGetMetadata,
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
  let mockStorage: MockStorageInstance;
  let mockBucket: Mock;
  let mockFile: Mock;
  let mockSave: Mock;
  let mockExists: Mock;
  let mockDelete: Mock;
  let mockMove: Mock;
  let mockGetMetadata: Mock;

  /**
   * Helper to set up successful upload mocks with proper size verification
   */
  const setupSuccessfulUpload = (fileContent: string): void => {
    mockSave.mockResolvedValue(undefined);
    mockMove.mockResolvedValue(undefined);
    mockGetMetadata.mockResolvedValue([
      { size: Buffer.byteLength(fileContent, "utf8") },
    ]);
  };

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
    mockExists = fileInstance.exists;
    mockDelete = fileInstance.delete;
    mockMove = fileInstance.move;
    mockGetMetadata = fileInstance.getMetadata;

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
      const fileContent = '{"key": "value"}';
      setupSuccessfulUpload(fileContent);

      const url = await bucketStore.storeFile("test-file.json", fileContent);

      expect(url).toBe(
        "https://storage.googleapis.com/test-bucket/test-file.json",
      );
    });

    it("should call bucket() with correct bucket name", async () => {
      const fileContent = '{"key": "value"}';
      setupSuccessfulUpload(fileContent);
      mockBucket.mockClear();

      await bucketStore.storeFile("test-file.json", fileContent);

      expect(mockBucket).toHaveBeenCalledWith("test-bucket");
      expect(mockBucket).toHaveBeenCalledTimes(1);
    });

    it("should call file() with correct file name", async () => {
      const fileContent = '{"data": 123}';
      setupSuccessfulUpload(fileContent);
      mockFile.mockClear();

      await bucketStore.storeFile("my-data.json", fileContent);

      expect(mockFile).toHaveBeenCalledWith("my-data.json");
      expect(mockFile).toHaveBeenCalledTimes(2); // Once for temp file, once for final file
    });

    it("should call save() with correct content and metadata", async () => {
      const fileContent = '{"test": "data"}';
      setupSuccessfulUpload(fileContent);

      await bucketStore.storeFile("test.json", fileContent);

      expect(mockSave).toHaveBeenCalledWith(fileContent, {
        metadata: {
          contentType: "application/json",
        },
      });
      expect(mockSave).toHaveBeenCalledTimes(1);
    });

    it("should set contentType to application/json", async () => {
      const fileContent = "{}";
      setupSuccessfulUpload(fileContent);

      await bucketStore.storeFile("test.json", fileContent);

      const saveCall = mockSave.mock.calls[0];
      expect(saveCall[1].metadata.contentType).toBe("application/json");
    });

    it("should handle file names with special characters", async () => {
      const fileContent = "{}";
      setupSuccessfulUpload(fileContent);

      const fileName = "reports/2024/data-file_v1.2.json";
      const url = await bucketStore.storeFile(fileName, fileContent);

      expect(mockFile).toHaveBeenCalledWith(fileName);
      expect(url).toBe(
        `https://storage.googleapis.com/test-bucket/${fileName}`,
      );
    });

    it("should handle empty file content", async () => {
      const fileContent = "";
      setupSuccessfulUpload(fileContent);

      const url = await bucketStore.storeFile("empty.json", fileContent);

      expect(mockSave).toHaveBeenCalledWith("", {
        metadata: {
          contentType: "application/json",
        },
      });
      expect(url).toBe("https://storage.googleapis.com/test-bucket/empty.json");
    });

    it("should handle large file content", async () => {
      const largeContent = JSON.stringify({ data: "x".repeat(10000) });
      setupSuccessfulUpload(largeContent);

      const url = await bucketStore.storeFile("large.json", largeContent);

      expect(mockSave).toHaveBeenCalledWith(largeContent, {
        metadata: {
          contentType: "application/json",
        },
      });
      expect(url).toBe("https://storage.googleapis.com/test-bucket/large.json");
    });

    it("should generate URL with correct format", async () => {
      const fileContent = "{}";
      setupSuccessfulUpload(fileContent);

      const url = await bucketStore.storeFile("path/to/file.json", fileContent);

      expect(url).toMatch(/^https:\/\/storage\.googleapis\.com\/[^/]+\/.+$/);
      expect(url).toContain("test-bucket");
      expect(url).toContain("path/to/file.json");
    });
  });

  describe("storeFile - Atomic Upload", () => {
    it("should upload to temporary file first then move to final name", async () => {
      const fileContent = '{"data": "test"}';
      setupSuccessfulUpload(fileContent);
      mockFile.mockClear();

      await bucketStore.storeFile("report.json", fileContent);

      // Should create temp file first using UUID format
      const firstFileCall = mockFile.mock.calls[0][0];
      expect(firstFileCall).toMatch(
        /^report\.json\.tmp\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );

      // Should create final file reference for move operation
      const secondFileCall = mockFile.mock.calls[1][0];
      expect(secondFileCall).toBe("report.json");

      // Should call move to atomically rename temp file to final name
      expect(mockMove).toHaveBeenCalledTimes(1);
    });

    it("should use unique temporary filename using UUID", async () => {
      const fileContent = "{}";
      setupSuccessfulUpload(fileContent);
      mockFile.mockClear();

      // Create multiple uploads to verify uniqueness
      await bucketStore.storeFile("test.json", fileContent);
      await bucketStore.storeFile("test.json", fileContent);

      const tempFileName1 = mockFile.mock.calls[0][0];
      const tempFileName2 = mockFile.mock.calls[2][0]; // Skip final file call at index 1

      // Both should match UUID pattern
      const uuidPattern =
        /^test\.json\.tmp\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
      expect(tempFileName1).toMatch(uuidPattern);
      expect(tempFileName2).toMatch(uuidPattern);

      // UUIDs should be different
      expect(tempFileName1).not.toBe(tempFileName2);
    });

    it("should not leave temporary file if move succeeds", async () => {
      const fileContent = "{}";
      setupSuccessfulUpload(fileContent);

      await bucketStore.storeFile("test.json", fileContent);

      // Delete should not be called on temp file - move handles cleanup
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("should throw error if temporary file save fails", async () => {
      const saveError = new Error("Disk full");
      mockSave.mockRejectedValue(saveError);

      await expect(bucketStore.storeFile("test.json", "{}")).rejects.toThrow(
        UploadFailedError,
      );

      // Move should not be called if save fails
      expect(mockMove).not.toHaveBeenCalled();
    });

    it("should throw error if move fails after successful save", async () => {
      mockSave.mockResolvedValue(undefined);
      const moveError = new Error("Permission denied");
      mockMove.mockRejectedValue(moveError);

      await expect(bucketStore.storeFile("test.json", "{}")).rejects.toThrow(
        UploadFailedError,
      );

      try {
        await bucketStore.storeFile("test.json", "{}");
      } catch (error) {
        expect(error).toBeInstanceOf(UploadFailedError);
        if (error instanceof UploadFailedError) {
          expect(error.fileName).toBe("test.json");
          expect(error.reason).toContain("Permission denied");
        }
      }
    });

    it("should prevent serving corrupted files by using atomic move", async () => {
      const fileContent = '{"data": "complete"}';
      setupSuccessfulUpload(fileContent);

      await bucketStore.storeFile("report.json", fileContent);

      // Verify move was called
      // This ensures partial uploads never make it to the final filename
      expect(mockMove).toHaveBeenCalledTimes(1);
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
      // biome-ignore lint/suspicious/noExplicitAny: Testing edge case with malformed error
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

  describe("storeFile - Upload Verification", () => {
    it("should verify upload integrity by checking file size", async () => {
      const fileContent = '{"test": "data", "count": 42}';
      const expectedSize = Buffer.byteLength(fileContent, "utf8");

      setupSuccessfulUpload(fileContent);

      await bucketStore.storeFile("test.json", fileContent);

      expect(mockGetMetadata).toHaveBeenCalledTimes(1);
      expect(mockGetMetadata).toHaveBeenCalled();
    });

    it("should throw error when uploaded size does not match expected size", async () => {
      const fileContent = '{"test": "data"}';
      mockSave.mockResolvedValue(undefined);
      mockDelete.mockResolvedValue(undefined);
      // Simulate corrupted upload - size mismatch
      mockGetMetadata.mockResolvedValue([{ size: 999 }]);

      await expect(
        bucketStore.storeFile("test.json", fileContent),
      ).rejects.toThrow(UploadFailedError);

      // Verify error details
      try {
        await bucketStore.storeFile("test.json", fileContent);
      } catch (error) {
        expect(error).toBeInstanceOf(UploadFailedError);
        if (error instanceof UploadFailedError) {
          expect(error.reason).toContain("Upload verification failed");
          expect(error.reason).toContain("expected");
          expect(error.reason).toContain("got 999 bytes");
        }
      }

      // Verify temp file was cleaned up (called twice, once per storeFile call)
      expect(mockDelete).toHaveBeenCalledTimes(2);
      // Verify move was never called (file never made public)
      expect(mockMove).not.toHaveBeenCalled();
    });

    it("should calculate correct byte size for UTF-8 content", async () => {
      const fileContent = "Hello 世界 🌍"; // Mixed ASCII, Chinese, emoji
      const expectedSize = Buffer.byteLength(fileContent, "utf8");

      setupSuccessfulUpload(fileContent);

      await bucketStore.storeFile("unicode.json", fileContent);

      expect(mockGetMetadata).toHaveBeenCalledTimes(1);
    });

    it("should verify empty file upload correctly", async () => {
      const fileContent = "";
      setupSuccessfulUpload(fileContent);

      const url = await bucketStore.storeFile("empty.json", fileContent);

      expect(url).toBe("https://storage.googleapis.com/test-bucket/empty.json");
      expect(mockGetMetadata).toHaveBeenCalledTimes(1);
    });

    it("should verify large file upload correctly", async () => {
      const largeContent = JSON.stringify({ data: "x".repeat(100000) });
      setupSuccessfulUpload(largeContent);

      const url = await bucketStore.storeFile("large.json", largeContent);

      expect(url).toBe("https://storage.googleapis.com/test-bucket/large.json");
      expect(mockGetMetadata).toHaveBeenCalledTimes(1);
    });

    it("should handle metadata without size field gracefully", async () => {
      const fileContent = '{"test": "data"}';
      mockSave.mockResolvedValue(undefined);
      mockMove.mockResolvedValue(undefined);
      // Metadata without size field (shouldn't happen in practice, but defensive)
      mockGetMetadata.mockResolvedValue([{}]);

      // Should not throw error, verification is skipped
      const url = await bucketStore.storeFile("test.json", fileContent);

      expect(url).toBe("https://storage.googleapis.com/test-bucket/test.json");
    });

    it("should throw error if getMetadata fails after successful upload", async () => {
      const fileContent = '{"test": "data"}';
      mockSave.mockResolvedValue(undefined);
      mockMove.mockResolvedValue(undefined);
      mockGetMetadata.mockRejectedValue(new Error("Metadata fetch failed"));

      await expect(
        bucketStore.storeFile("test.json", fileContent),
      ).rejects.toThrow(UploadFailedError);

      try {
        await bucketStore.storeFile("test.json", fileContent);
      } catch (error) {
        expect(error).toBeInstanceOf(UploadFailedError);
        if (error instanceof UploadFailedError) {
          expect(error.reason).toContain("Metadata fetch failed");
        }
      }
    });

    it("should verify size matches for exact byte boundaries", async () => {
      // Test with content that's exactly at common byte boundaries
      const fileContent = "x".repeat(1024); // 1KB
      setupSuccessfulUpload(fileContent);

      await bucketStore.storeFile("1kb.json", fileContent);

      expect(mockGetMetadata).toHaveBeenCalledTimes(1);
    });

    it("should verify temp file before moving to prevent race condition", async () => {
      const fileContent = '{"test": "data"}';
      mockSave.mockResolvedValue(undefined);
      mockGetMetadata.mockResolvedValue([
        { size: Buffer.byteLength(fileContent, "utf8") },
      ]);
      mockMove.mockResolvedValue(undefined);

      await bucketStore.storeFile("test.json", fileContent);

      // Verify the call order: save, getMetadata (verify), then move
      const callOrder = [
        mockSave.mock.invocationCallOrder[0],
        mockGetMetadata.mock.invocationCallOrder[0],
        mockMove.mock.invocationCallOrder[0],
      ];

      // Ensure getMetadata is called before move
      expect(callOrder[0]).toBeLessThan(callOrder[1]); // save before verify
      expect(callOrder[1]).toBeLessThan(callOrder[2]); // verify before move
    });

    it("should clean up temp file and never move when verification fails", async () => {
      const fileContent = '{"test": "data"}';
      mockSave.mockResolvedValue(undefined);
      mockDelete.mockResolvedValue(undefined);
      // Simulate size mismatch
      mockGetMetadata.mockResolvedValue([{ size: 9999 }]);

      await expect(
        bucketStore.storeFile("test.json", fileContent),
      ).rejects.toThrow(UploadFailedError);

      // Temp file should be deleted
      expect(mockDelete).toHaveBeenCalledTimes(1);
      // File should never be moved to final location
      expect(mockMove).not.toHaveBeenCalled();
    });
  });

  describe("Integration Scenarios", () => {
    it("should handle multiple sequential uploads", async () => {
      const fileContent = "{}";
      setupSuccessfulUpload(fileContent);

      const url1 = await bucketStore.storeFile("file1.json", fileContent);
      const url2 = await bucketStore.storeFile("file2.json", fileContent);
      const url3 = await bucketStore.storeFile("file3.json", fileContent);

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
      mockMove.mockResolvedValue(undefined);
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
      const fileContent = "{}";
      setupSuccessfulUpload(fileContent);
      mockBucket.mockClear();

      await bucketStore.storeFile("file1.json", fileContent);
      await bucketStore.storeFile("file2.json", fileContent);

      expect(mockBucket).toHaveBeenCalledWith("test-bucket");
      expect(mockBucket).toHaveBeenCalledTimes(2);
    });

    it("should work correctly with different bucket instances", async () => {
      const fileContent = "{}";
      setupSuccessfulUpload(fileContent);

      const store1 = new GCPBucketStore("bucket-1");
      const store2 = new GCPBucketStore("bucket-2");

      await store1.storeFile("file.json", fileContent);
      await store2.storeFile("file.json", fileContent);

      // Both should have been called with their respective bucket names
      const bucketCalls = mockBucket.mock.calls;
      expect(bucketCalls).toContainEqual(["bucket-1"]);
      expect(bucketCalls).toContainEqual(["bucket-2"]);
    });

    it("should handle concurrent uploads to same bucket", async () => {
      const fileContent = "{}";
      setupSuccessfulUpload(fileContent);

      const promises = [
        bucketStore.storeFile("file1.json", fileContent),
        bucketStore.storeFile("file2.json", fileContent),
        bucketStore.storeFile("file3.json", fileContent),
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
      const fileContent = "{}";
      setupSuccessfulUpload(fileContent);

      const fileName = "file with spaces.json";
      const url = await bucketStore.storeFile(fileName, fileContent);

      expect(mockFile).toHaveBeenCalledWith(fileName);
      expect(url).toContain("file with spaces.json");
    });

    it("should handle file names with unicode characters", async () => {
      const fileContent = "{}";
      setupSuccessfulUpload(fileContent);

      const fileName = "файл-данных-文件.json";
      const url = await bucketStore.storeFile(fileName, fileContent);

      expect(mockFile).toHaveBeenCalledWith(fileName);
      expect(url).toBe(
        `https://storage.googleapis.com/test-bucket/${fileName}`,
      );
    });

    it("should handle very long file names", async () => {
      const fileContent = "{}";
      setupSuccessfulUpload(fileContent);

      const longFileName = `${"a".repeat(500)}.json`;
      const url = await bucketStore.storeFile(longFileName, fileContent);

      expect(mockFile).toHaveBeenCalledWith(longFileName);
      expect(url).toBe(
        `https://storage.googleapis.com/test-bucket/${longFileName}`,
      );
    });

    it("should handle file content with special JSON characters", async () => {
      const fileContent = '{"text": "Hello \\"world\\"\\n\\t"}';
      setupSuccessfulUpload(fileContent);

      const url = await bucketStore.storeFile("test.json", fileContent);

      expect(mockSave).toHaveBeenCalledWith(fileContent, expect.any(Object));
      expect(url).toBe("https://storage.googleapis.com/test-bucket/test.json");
    });

    it("should handle nested file paths", async () => {
      const fileContent = "{}";
      setupSuccessfulUpload(fileContent);

      const fileName = "a/b/c/d/e/file.json";
      const url = await bucketStore.storeFile(fileName, fileContent);

      expect(url).toBe(
        "https://storage.googleapis.com/test-bucket/a/b/c/d/e/file.json",
      );
    });

    it("should handle file names with multiple dots", async () => {
      const fileContent = "{}";
      setupSuccessfulUpload(fileContent);

      const fileName = "data.backup.v2.0.json";
      const url = await bucketStore.storeFile(fileName, fileContent);

      expect(mockFile).toHaveBeenCalledWith(fileName);
      expect(url).toBe(
        `https://storage.googleapis.com/test-bucket/${fileName}`,
      );
    });

    it("should handle bucket name with hyphens", async () => {
      const fileContent = "{}";
      setupSuccessfulUpload(fileContent);

      const store = new GCPBucketStore("my-test-bucket-123");
      const url = await store.storeFile("file.json", fileContent);

      expect(url).toContain("my-test-bucket-123");
    });
  });

  describe("Error Type Verification", () => {
    it("should return string type on successful upload", async () => {
      const fileContent = "{}";
      setupSuccessfulUpload(fileContent);

      const url = await bucketStore.storeFile("test.json", fileContent);

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

  describe("fileExists - Success Scenarios", () => {
    it("should return true when file exists", async () => {
      mockExists.mockResolvedValue([true]);

      const result = await bucketStore.fileExists("test-file.json");

      expect(result.exists).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockBucket).toHaveBeenCalledWith("test-bucket");
      expect(mockFile).toHaveBeenCalledWith("test-file.json");
      expect(mockExists).toHaveBeenCalled();
    });

    it("should return false when file does not exist", async () => {
      mockExists.mockResolvedValue([false]);

      const result = await bucketStore.fileExists("missing-file.json");

      expect(result.exists).toBe(false);
      expect(result.error).toBeUndefined();
      expect(mockBucket).toHaveBeenCalledWith("test-bucket");
      expect(mockFile).toHaveBeenCalledWith("missing-file.json");
      expect(mockExists).toHaveBeenCalled();
    });

    it("should handle different file paths", async () => {
      mockExists.mockResolvedValue([true]);

      const result = await bucketStore.fileExists("folder/subfolder/file.json");

      expect(result.exists).toBe(true);
      expect(mockFile).toHaveBeenCalledWith("folder/subfolder/file.json");
    });
  });

  describe("fileExists - Error Scenarios", () => {
    it("should return error result for permission errors with string matching", async () => {
      mockExists.mockRejectedValue(new Error("Permission denied"));

      const result = await bucketStore.fileExists("test.json");

      expect(result.exists).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("Failed to check file existence");
      expect(result.error?.message).toContain("Permission denied");
      expect(result.errorType).toBe("permission");
    });

    it("should categorize network errors as transient", async () => {
      mockExists.mockRejectedValue(new Error("Network timeout"));

      const result = await bucketStore.fileExists("test.json");

      expect(result.exists).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.errorType).toBe("transient");
    });

    it("should categorize 403 errors as permission using ApiError.code", async () => {
      const error = new Error("Access denied");
      (error as { code?: number }).code = 403;

      mockExists.mockRejectedValue(error);

      const result = await bucketStore.fileExists("test.json");

      expect(result.exists).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.errorType).toBe("permission");
    });

    it("should categorize 404 errors as not_found using ApiError.code", async () => {
      const error = new Error("Not found");
      (error as { code?: number }).code = 404;

      mockExists.mockRejectedValue(error);

      const result = await bucketStore.fileExists("test.json");

      expect(result.exists).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.errorType).toBe("not_found");
    });

    it("should categorize 503 errors as transient using ApiError.code", async () => {
      const error = new Error("Service unavailable");
      (error as { code?: number }).code = 503;

      mockExists.mockRejectedValue(error);

      const result = await bucketStore.fileExists("test.json");

      expect(result.exists).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.errorType).toBe("transient");
    });

    it("should categorize 400 errors as permanent using ApiError.code", async () => {
      const error = new Error("Bad request");
      (error as { code?: number }).code = 400;

      mockExists.mockRejectedValue(error);

      const result = await bucketStore.fileExists("test.json");

      expect(result.exists).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.errorType).toBe("permanent");
    });

    it("should categorize unknown errors as permanent", async () => {
      mockExists.mockRejectedValue(new Error("Unknown error"));

      const result = await bucketStore.fileExists("test.json");

      expect(result.exists).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.errorType).toBe("permanent");
    });
  });

  describe("deleteFile - Success Scenarios", () => {
    it("should successfully delete a file", async () => {
      mockDelete.mockResolvedValue(undefined);

      await bucketStore.deleteFile("test-file.json");

      expect(mockBucket).toHaveBeenCalledWith("test-bucket");
      expect(mockFile).toHaveBeenCalledWith("test-file.json");
      expect(mockDelete).toHaveBeenCalled();
    });

    it("should call bucket with correct bucket name", async () => {
      mockDelete.mockResolvedValue(undefined);
      mockBucket.mockClear();

      await bucketStore.deleteFile("test.json");

      expect(mockBucket).toHaveBeenCalledWith("test-bucket");
      expect(mockBucket).toHaveBeenCalledTimes(1);
    });

    it("should call file with correct file name", async () => {
      mockDelete.mockResolvedValue(undefined);
      mockFile.mockClear();

      await bucketStore.deleteFile("report.json");

      expect(mockFile).toHaveBeenCalledWith("report.json");
      expect(mockFile).toHaveBeenCalledTimes(1);
    });

    it("should handle file names with paths", async () => {
      mockDelete.mockResolvedValue(undefined);

      await bucketStore.deleteFile("reports/2024/report.json");

      expect(mockFile).toHaveBeenCalledWith("reports/2024/report.json");
      expect(mockDelete).toHaveBeenCalled();
    });

    it("should handle multiple sequential deletions", async () => {
      mockDelete.mockResolvedValue(undefined);

      await bucketStore.deleteFile("file1.json");
      await bucketStore.deleteFile("file2.json");
      await bucketStore.deleteFile("file3.json");

      expect(mockDelete).toHaveBeenCalledTimes(3);
    });
  });

  describe("deleteFile - Error Scenarios", () => {
    it("should throw DeleteFailedError when deletion fails", async () => {
      const deleteError = new Error("File not found");
      mockDelete.mockRejectedValue(deleteError);

      await expect(bucketStore.deleteFile("test.json")).rejects.toThrow(
        DeleteFailedError,
      );

      try {
        await bucketStore.deleteFile("test.json");
      } catch (error) {
        expect(error).toBeInstanceOf(DeleteFailedError);
        if (error instanceof DeleteFailedError) {
          expect(error.fileName).toBe("test.json");
          expect(error.reason).toBe("File not found");
        }
      }
    });

    it("should throw DeleteFailedError with correct properties", async () => {
      mockDelete.mockRejectedValue(new Error("Permission denied"));

      try {
        await bucketStore.deleteFile("protected.json");
      } catch (error) {
        expect(error).toBeInstanceOf(DeleteFailedError);
        if (error instanceof DeleteFailedError) {
          expect(error.fileName).toBe("protected.json");
          expect(error.reason).toBe("Permission denied");
          expect(error.name).toBe("DeleteFailedError");
        }
      }
    });

    it("should handle permission denied error", async () => {
      const permissionError = new Error(
        "Access denied: Insufficient permissions",
      );
      mockDelete.mockRejectedValue(permissionError);

      try {
        await bucketStore.deleteFile("test.json");
      } catch (error) {
        expect(error).toBeInstanceOf(DeleteFailedError);
        if (error instanceof DeleteFailedError) {
          expect(error.reason).toContain("Access denied");
        }
      }
    });

    it("should handle network errors", async () => {
      mockDelete.mockRejectedValue(new Error("Network timeout"));

      try {
        await bucketStore.deleteFile("test.json");
      } catch (error) {
        expect(error).toBeInstanceOf(DeleteFailedError);
        if (error instanceof DeleteFailedError) {
          expect(error.reason).toBe("Network timeout");
        }
      }
    });

    it("should handle non-Error object thrown during deletion", async () => {
      mockDelete.mockRejectedValue({ code: 404, message: "Not found" });

      await expect(bucketStore.deleteFile("test.json")).rejects.toThrow(
        DeleteFailedError,
      );

      try {
        await bucketStore.deleteFile("test.json");
      } catch (error) {
        expect(error).toBeInstanceOf(DeleteFailedError);
        if (error instanceof DeleteFailedError) {
          expect(error.fileName).toBe("test.json");
          expect(error.reason).toBe("Not found");
        }
      }
    });
  });

  describe("deleteFile - Error Categorization", () => {
    it("should categorize 403 errors as permission using ApiError.code", async () => {
      const error = new Error("Access denied");
      (error as { code?: number }).code = 403;

      mockDelete.mockRejectedValue(error);

      try {
        await bucketStore.deleteFile("test.json");
      } catch (error) {
        expect(error).toBeInstanceOf(DeleteFailedError);
        if (error instanceof DeleteFailedError) {
          expect(error.fileName).toBe("test.json");
          expect(error.errorType).toBe("permission");
        }
      }
    });

    it("should categorize 401 errors as permission using ApiError.code", async () => {
      const error = new Error("Unauthorized");
      (error as { code?: number }).code = 401;

      mockDelete.mockRejectedValue(error);

      try {
        await bucketStore.deleteFile("test.json");
      } catch (error) {
        expect(error).toBeInstanceOf(DeleteFailedError);
        if (error instanceof DeleteFailedError) {
          expect(error.errorType).toBe("permission");
        }
      }
    });

    it("should categorize 404 errors as not_found using ApiError.code", async () => {
      const error = new Error("Not found");
      (error as { code?: number }).code = 404;

      mockDelete.mockRejectedValue(error);

      try {
        await bucketStore.deleteFile("test.json");
      } catch (error) {
        expect(error).toBeInstanceOf(DeleteFailedError);
        if (error instanceof DeleteFailedError) {
          expect(error.errorType).toBe("not_found");
        }
      }
    });

    it("should categorize 410 errors as not_found using ApiError.code", async () => {
      const error = new Error("Gone");
      (error as { code?: number }).code = 410;

      mockDelete.mockRejectedValue(error);

      try {
        await bucketStore.deleteFile("test.json");
      } catch (error) {
        expect(error).toBeInstanceOf(DeleteFailedError);
        if (error instanceof DeleteFailedError) {
          expect(error.errorType).toBe("not_found");
        }
      }
    });

    it("should categorize 503 errors as transient using ApiError.code", async () => {
      const error = new Error("Service unavailable");
      (error as { code?: number }).code = 503;

      mockDelete.mockRejectedValue(error);

      try {
        await bucketStore.deleteFile("test.json");
      } catch (error) {
        expect(error).toBeInstanceOf(DeleteFailedError);
        if (error instanceof DeleteFailedError) {
          expect(error.errorType).toBe("transient");
        }
      }
    });

    it("should categorize 504 errors as transient using ApiError.code", async () => {
      const error = new Error("Gateway timeout");
      (error as { code?: number }).code = 504;

      mockDelete.mockRejectedValue(error);

      try {
        await bucketStore.deleteFile("test.json");
      } catch (error) {
        expect(error).toBeInstanceOf(DeleteFailedError);
        if (error instanceof DeleteFailedError) {
          expect(error.errorType).toBe("transient");
        }
      }
    });

    it("should categorize 429 errors as transient using ApiError.code", async () => {
      const error = new Error("Too many requests");
      (error as { code?: number }).code = 429;

      mockDelete.mockRejectedValue(error);

      try {
        await bucketStore.deleteFile("test.json");
      } catch (error) {
        expect(error).toBeInstanceOf(DeleteFailedError);
        if (error instanceof DeleteFailedError) {
          expect(error.errorType).toBe("transient");
        }
      }
    });

    it("should categorize 500 errors as transient using ApiError.code", async () => {
      const error = new Error("Internal server error");
      (error as { code?: number }).code = 500;

      mockDelete.mockRejectedValue(error);

      try {
        await bucketStore.deleteFile("test.json");
      } catch (error) {
        expect(error).toBeInstanceOf(DeleteFailedError);
        if (error instanceof DeleteFailedError) {
          expect(error.errorType).toBe("transient");
        }
      }
    });

    it("should categorize 400 errors as permanent using ApiError.code", async () => {
      const error = new Error("Bad request");
      (error as { code?: number }).code = 400;

      mockDelete.mockRejectedValue(error);

      try {
        await bucketStore.deleteFile("test.json");
      } catch (error) {
        expect(error).toBeInstanceOf(DeleteFailedError);
        if (error instanceof DeleteFailedError) {
          expect(error.errorType).toBe("permanent");
        }
      }
    });

    it("should categorize permission errors with string matching", async () => {
      mockDelete.mockRejectedValue(new Error("Permission denied"));

      try {
        await bucketStore.deleteFile("test.json");
      } catch (error) {
        expect(error).toBeInstanceOf(DeleteFailedError);
        if (error instanceof DeleteFailedError) {
          expect(error.errorType).toBe("permission");
        }
      }
    });

    it("should categorize network timeout as transient", async () => {
      mockDelete.mockRejectedValue(new Error("Network timeout"));

      try {
        await bucketStore.deleteFile("test.json");
      } catch (error) {
        expect(error).toBeInstanceOf(DeleteFailedError);
        if (error instanceof DeleteFailedError) {
          expect(error.errorType).toBe("transient");
        }
      }
    });

    it("should categorize ETIMEDOUT as transient", async () => {
      mockDelete.mockRejectedValue(new Error("ETIMEDOUT"));

      try {
        await bucketStore.deleteFile("test.json");
      } catch (error) {
        expect(error).toBeInstanceOf(DeleteFailedError);
        if (error instanceof DeleteFailedError) {
          expect(error.errorType).toBe("transient");
        }
      }
    });

    it("should categorize ECONNREFUSED as transient", async () => {
      mockDelete.mockRejectedValue(new Error("ECONNREFUSED"));

      try {
        await bucketStore.deleteFile("test.json");
      } catch (error) {
        expect(error).toBeInstanceOf(DeleteFailedError);
        if (error instanceof DeleteFailedError) {
          expect(error.errorType).toBe("transient");
        }
      }
    });

    it("should categorize unknown errors as permanent", async () => {
      mockDelete.mockRejectedValue(new Error("Unknown error"));

      try {
        await bucketStore.deleteFile("test.json");
      } catch (error) {
        expect(error).toBeInstanceOf(DeleteFailedError);
        if (error instanceof DeleteFailedError) {
          expect(error.errorType).toBe("permanent");
        }
      }
    });

    it("should preserve fileName in categorized errors", async () => {
      const error = new Error("Service unavailable");
      (error as { code?: number }).code = 503;

      mockDelete.mockRejectedValue(error);

      const fileName = "reports/2024/data.json";

      try {
        await bucketStore.deleteFile(fileName);
      } catch (error) {
        expect(error).toBeInstanceOf(DeleteFailedError);
        if (error instanceof DeleteFailedError) {
          expect(error.fileName).toBe(fileName);
          expect(error.errorType).toBe("transient");
        }
      }
    });
  });
});
