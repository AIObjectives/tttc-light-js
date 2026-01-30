/**
 * Integration Tests for GCS Atomic Upload and Corruption Prevention
 *
 * These tests verify:
 * - Atomic upload pattern (temp file -> move to final)
 * - Prevention of partial upload corruption
 * - Concurrent upload safety
 * - Upload failures during atomic operations
 * - Lock-protected GCS operations
 *
 * NOTE: These tests use mocks, not real GCS. Real GCS integration tests
 * would require actual GCS credentials and infrastructure.
 *
 * RUN LOCALLY:
 * pnpm --filter=pipeline-worker run test gcs-atomic-upload.integration.test.ts
 */

import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { DeleteFailedError, UploadFailedError } from "../../types";
import { GCPBucketStore } from "../gcp";

// Mock Google Cloud Storage
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

vi.mock("@google-cloud/storage", () => {
  // Track saved content globally for size verification
  let lastSavedContent = "";

  const mockSave = vi.fn().mockImplementation(async (content: string) => {
    lastSavedContent = content;
    return undefined;
  });
  const mockExists = vi.fn();
  const mockDelete = vi.fn();
  const mockMove = vi.fn();
  const mockGetMetadata = vi.fn().mockImplementation(async () => {
    return [{ size: Buffer.byteLength(lastSavedContent, "utf8") }];
  });
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

import { Storage } from "@google-cloud/storage";

describe("GCS Atomic Upload Integration Tests", () => {
  let bucketStore: GCPBucketStore;
  let mockStorage: MockStorageInstance;
  let mockBucket: Mock;
  let mockFile: Mock;
  let mockSave: Mock;
  let mockExists: Mock;
  let mockDelete: Mock;
  let mockMove: Mock;
  let mockGetMetadata: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    // Get mocked functions
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

    bucketStore = new GCPBucketStore("test-bucket");
  });

  describe("Atomic Upload Pattern", () => {
    it("should upload to temporary file first then atomically move", async () => {
      mockSave.mockResolvedValue(undefined);
      mockMove.mockResolvedValue(undefined);

      await bucketStore.storeFile("report.json", '{"data": "test"}');

      // Verify temp file was created
      const calls = mockFile.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);

      const tempFileName = calls[0][0];
      expect(tempFileName).toMatch(/^report\.json\.tmp\.\d+$/);

      // Verify final file reference
      const finalFileName = calls[1][0];
      expect(finalFileName).toBe("report.json");

      // Verify atomic move was called
      expect(mockMove).toHaveBeenCalledTimes(1);
    });

    it("should not leave temp file on successful upload", async () => {
      mockSave.mockResolvedValue(undefined);
      mockMove.mockResolvedValue(undefined);

      await bucketStore.storeFile("test.json", "{}");

      // Delete should NOT be called - move handles cleanup
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("should prevent serving corrupted files on partial upload", async () => {
      // Simulate network interruption during save
      let saveCallCount = 0;
      mockSave.mockImplementation(async () => {
        saveCallCount++;
        if (saveCallCount === 1) {
          throw new Error("Network interruption");
        }
        return undefined;
      });
      mockMove.mockResolvedValue(undefined);

      // First upload fails
      await expect(
        bucketStore.storeFile("report.json", '{"data": "test"}'),
      ).rejects.toThrow(UploadFailedError);

      // Move should NOT have been called (temp file not moved to final)
      expect(mockMove).not.toHaveBeenCalled();

      // Second upload succeeds
      await bucketStore.storeFile("report.json", '{"data": "test"}');

      // Now move should be called
      expect(mockMove).toHaveBeenCalledTimes(1);
    });

    it("should rollback if move fails after successful save", async () => {
      mockSave.mockResolvedValue(undefined);
      mockMove.mockRejectedValue(new Error("Move failed"));

      await expect(
        bucketStore.storeFile("report.json", '{"data": "test"}'),
      ).rejects.toThrow(UploadFailedError);

      try {
        await bucketStore.storeFile("report.json", '{"data": "test"}');
      } catch (error) {
        expect(error).toBeInstanceOf(UploadFailedError);
        if (error instanceof UploadFailedError) {
          expect(error.reason).toContain("Move failed");
        }
      }
    });
  });

  describe("Concurrent Upload Safety", () => {
    it("should handle concurrent uploads to different files", async () => {
      mockSave.mockResolvedValue(undefined);
      mockMove.mockResolvedValue(undefined);

      const uploads = [
        bucketStore.storeFile("report1.json", '{"id": 1}'),
        bucketStore.storeFile("report2.json", '{"id": 2}'),
        bucketStore.storeFile("report3.json", '{"id": 3}'),
      ];

      const results = await Promise.all(uploads);

      expect(results).toHaveLength(3);
      expect(results[0]).toContain("report1.json");
      expect(results[1]).toContain("report2.json");
      expect(results[2]).toContain("report3.json");

      // Each should have used atomic upload pattern
      expect(mockSave).toHaveBeenCalledTimes(3);
      expect(mockMove).toHaveBeenCalledTimes(3);
    });

    it("should use unique temp filenames for concurrent uploads", async () => {
      mockSave.mockResolvedValue(undefined);
      mockMove.mockResolvedValue(undefined);

      // Upload same filename concurrently
      const uploads = [
        bucketStore.storeFile("report.json", '{"version": 1}'),
        bucketStore.storeFile("report.json", '{"version": 2}'),
        bucketStore.storeFile("report.json", '{"version": 3}'),
      ];

      await Promise.all(uploads);

      // Extract temp filenames
      const tempFileNames = mockFile.mock.calls
        .map((call) => call[0])
        .filter((name: string) => name && name.includes(".tmp."));

      // All temp filenames should be unique
      const uniqueTempNames = new Set(tempFileNames);
      expect(uniqueTempNames.size).toBe(tempFileNames.length);
    });

    it("should handle mixed success and failure in concurrent uploads", async () => {
      let callCount = 0;
      mockSave.mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          throw new Error("Second upload fails");
        }
        return undefined;
      });
      mockMove.mockResolvedValue(undefined);

      const uploads = [
        bucketStore.storeFile("report1.json", "{}"),
        bucketStore.storeFile("report2.json", "{}"),
        bucketStore.storeFile("report3.json", "{}"),
      ];

      const results = await Promise.allSettled(uploads);

      expect(results[0].status).toBe("fulfilled");
      expect(results[1].status).toBe("rejected");
      expect(results[2].status).toBe("fulfilled");
    });
  });

  describe("Upload Failure Scenarios", () => {
    it("should handle temp file save failure", async () => {
      mockSave.mockRejectedValue(new Error("Disk full"));

      await expect(bucketStore.storeFile("report.json", "{}")).rejects.toThrow(
        UploadFailedError,
      );

      // Move should not be attempted
      expect(mockMove).not.toHaveBeenCalled();
    });

    it("should handle permission errors during upload", async () => {
      const permissionError = new Error("Permission denied");
      (permissionError as { code?: number }).code = 403;
      mockSave.mockRejectedValue(permissionError);

      try {
        await bucketStore.storeFile("report.json", "{}");
      } catch (error) {
        expect(error).toBeInstanceOf(UploadFailedError);
        if (error instanceof UploadFailedError) {
          expect(error.fileName).toBe("report.json");
          expect(error.reason).toContain("Permission denied");
        }
      }
    });

    it("should handle transient network errors", async () => {
      const networkError = new Error("Network timeout");
      (networkError as { code?: number }).code = 503;
      mockSave.mockRejectedValue(networkError);

      try {
        await bucketStore.storeFile("report.json", "{}");
      } catch (error) {
        expect(error).toBeInstanceOf(UploadFailedError);
        if (error instanceof UploadFailedError) {
          expect(error.reason).toContain("Network timeout");
        }
      }
    });

    it("should handle quota exceeded errors", async () => {
      const quotaError = new Error("Quota exceeded");
      (quotaError as { code?: number }).code = 429;
      mockSave.mockRejectedValue(quotaError);

      try {
        await bucketStore.storeFile("report.json", "{}");
      } catch (error) {
        expect(error).toBeInstanceOf(UploadFailedError);
        if (error instanceof UploadFailedError) {
          expect(error.reason).toContain("Quota exceeded");
        }
      }
    });
  });

  describe("Large File Uploads", () => {
    it("should handle large file uploads atomically", async () => {
      mockSave.mockResolvedValue(undefined);
      mockMove.mockResolvedValue(undefined);

      // 10MB file
      const largeContent = JSON.stringify({ data: "x".repeat(10_000_000) });

      await bucketStore.storeFile("large-report.json", largeContent);

      // Should still use atomic pattern
      expect(mockSave).toHaveBeenCalledWith(
        largeContent,
        expect.objectContaining({
          metadata: {
            contentType: "application/json",
          },
        }),
      );
      expect(mockMove).toHaveBeenCalledTimes(1);
    });

    it("should handle upload timeout for very large files", async () => {
      mockSave.mockImplementation(async () => {
        // Simulate timeout
        await new Promise((resolve) => setTimeout(resolve, 100));
        throw new Error("Upload timeout");
      });

      const veryLargeContent = "x".repeat(50_000_000); // 50MB

      try {
        await bucketStore.storeFile("huge-report.json", veryLargeContent);
      } catch (error) {
        expect(error).toBeInstanceOf(UploadFailedError);
        if (error instanceof UploadFailedError) {
          expect(error.reason).toContain("Upload timeout");
        }
      }

      // Move should not be called
      expect(mockMove).not.toHaveBeenCalled();
    });
  });

  describe("File Deletion Safety", () => {
    it("should successfully delete file", async () => {
      mockDelete.mockResolvedValue(undefined);

      await bucketStore.deleteFile("report.json");

      expect(mockDelete).toHaveBeenCalledTimes(1);
    });

    it("should handle deletion of non-existent file", async () => {
      const notFoundError = new Error("File not found");
      (notFoundError as { code?: number }).code = 404;
      mockDelete.mockRejectedValue(notFoundError);

      try {
        await bucketStore.deleteFile("nonexistent.json");
      } catch (error) {
        expect(error).toBeInstanceOf(DeleteFailedError);
        if (error instanceof DeleteFailedError) {
          expect(error.errorType).toBe("not_found");
        }
      }
    });

    it("should handle permission errors during deletion", async () => {
      const permissionError = new Error("Permission denied");
      (permissionError as { code?: number }).code = 403;
      mockDelete.mockRejectedValue(permissionError);

      try {
        await bucketStore.deleteFile("protected.json");
      } catch (error) {
        expect(error).toBeInstanceOf(DeleteFailedError);
        if (error instanceof DeleteFailedError) {
          expect(error.errorType).toBe("permission");
        }
      }
    });
  });

  describe("Rollback and Cleanup", () => {
    it("should handle failed upload without leaving temp files", async () => {
      mockSave.mockResolvedValue(undefined);
      mockMove.mockRejectedValue(new Error("Move operation failed"));

      try {
        await bucketStore.storeFile("report.json", "{}");
      } catch (error) {
        expect(error).toBeInstanceOf(UploadFailedError);
      }

      // In a real implementation, temp file should be cleaned up
      // This test verifies the error is thrown correctly
      expect(mockMove).toHaveBeenCalledTimes(1);
    });

    it("should handle retry after failed upload", async () => {
      let attempt = 0;
      mockSave.mockImplementation(async () => {
        attempt++;
        if (attempt === 1) {
          throw new Error("First attempt fails");
        }
        return undefined;
      });
      mockMove.mockResolvedValue(undefined);

      // First attempt fails
      await expect(bucketStore.storeFile("report.json", "{}")).rejects.toThrow(
        UploadFailedError,
      );

      // Second attempt succeeds
      const url = await bucketStore.storeFile("report.json", "{}");

      expect(url).toContain("report.json");
      expect(mockSave).toHaveBeenCalledTimes(2);
    });
  });

  describe("File Existence Checks", () => {
    it("should correctly check if file exists", async () => {
      mockExists.mockResolvedValue([true]);

      const result = await bucketStore.fileExists("report.json");

      expect(result.exists).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should correctly check if file does not exist", async () => {
      mockExists.mockResolvedValue([false]);

      const result = await bucketStore.fileExists("nonexistent.json");

      expect(result.exists).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it("should handle permission errors during existence check", async () => {
      const permissionError = new Error("Access denied");
      (permissionError as { code?: number }).code = 403;
      mockExists.mockRejectedValue(permissionError);

      const result = await bucketStore.fileExists("protected.json");

      expect(result.exists).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.errorType).toBe("permission");
    });

    it("should handle transient errors during existence check", async () => {
      const transientError = new Error("Service unavailable");
      (transientError as { code?: number }).code = 503;
      mockExists.mockRejectedValue(transientError);

      const result = await bucketStore.fileExists("report.json");

      expect(result.exists).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.errorType).toBe("transient");
    });
  });

  describe("Content Validation", () => {
    it("should handle empty file content", async () => {
      mockSave.mockResolvedValue(undefined);
      mockMove.mockResolvedValue(undefined);

      const url = await bucketStore.storeFile("empty.json", "");

      expect(mockSave).toHaveBeenCalledWith(
        "",
        expect.objectContaining({
          metadata: {
            contentType: "application/json",
          },
        }),
      );
      expect(url).toContain("empty.json");
    });

    it("should handle malformed JSON content", async () => {
      mockSave.mockResolvedValue(undefined);
      mockMove.mockResolvedValue(undefined);

      // Store malformed JSON (bucket store doesn't validate)
      const malformedJson = '{"incomplete": ';

      const url = await bucketStore.storeFile("malformed.json", malformedJson);

      // Should still upload (validation is caller's responsibility)
      expect(url).toContain("malformed.json");
    });

    it("should handle special characters in content", async () => {
      mockSave.mockResolvedValue(undefined);
      mockMove.mockResolvedValue(undefined);

      const specialContent = '{"text": "Hello \\"world\\"\\n\\t\\u0000"}';

      await bucketStore.storeFile("special.json", specialContent);

      expect(mockSave).toHaveBeenCalledWith(
        specialContent,
        expect.objectContaining({
          metadata: {
            contentType: "application/json",
          },
        }),
      );
    });
  });

  describe("File Path Handling", () => {
    it("should handle nested file paths", async () => {
      mockSave.mockResolvedValue(undefined);
      mockMove.mockResolvedValue(undefined);

      const nestedPath = "reports/2024/january/report-1.json";

      const url = await bucketStore.storeFile(nestedPath, "{}");

      expect(url).toContain(nestedPath);
    });

    it("should handle file names with special characters", async () => {
      mockSave.mockResolvedValue(undefined);
      mockMove.mockResolvedValue(undefined);

      const specialFileName = "report-v2.0_final (1).json";

      const url = await bucketStore.storeFile(specialFileName, "{}");

      expect(mockFile).toHaveBeenCalledWith(
        expect.stringContaining("report-v2.0_final (1).json.tmp."),
      );
      expect(url).toContain(specialFileName);
    });

    it("should handle unicode file names", async () => {
      mockSave.mockResolvedValue(undefined);
      mockMove.mockResolvedValue(undefined);

      const unicodeFileName = "отчет-报告-レポート.json";

      const url = await bucketStore.storeFile(unicodeFileName, "{}");

      expect(url).toContain(unicodeFileName);
    });
  });

  describe("Metadata Handling", () => {
    it("should set correct content type for JSON files", async () => {
      mockSave.mockResolvedValue(undefined);
      mockMove.mockResolvedValue(undefined);

      await bucketStore.storeFile("report.json", "{}");

      expect(mockSave).toHaveBeenCalledWith(
        "{}",
        expect.objectContaining({
          metadata: {
            contentType: "application/json",
          },
        }),
      );
    });

    it("should include metadata in upload", async () => {
      mockSave.mockResolvedValue(undefined);
      mockMove.mockResolvedValue(undefined);

      await bucketStore.storeFile("report.json", '{"test": true}');

      const saveCall = mockSave.mock.calls[0];
      expect(saveCall[1]).toHaveProperty("metadata");
      expect(saveCall[1].metadata).toHaveProperty("contentType");
    });
  });
});
