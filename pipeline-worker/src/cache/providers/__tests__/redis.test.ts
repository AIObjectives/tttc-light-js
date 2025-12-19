import Redis from "ioredis";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import {
  CacheDeleteError,
  CacheGetError,
  CacheSetError,
  type RedisCacheConfig,
} from "../../types";
import { RedisCache } from "../redis";

// Module-level mock functions that will be shared
const mockSet = vi.fn();
const mockSetex = vi.fn();
const mockGet = vi.fn();
const mockDel = vi.fn();
const mockDisconnect = vi.fn();
const mockOn = vi.fn();

// Mock the ioredis module
vi.mock("ioredis", () => {
  return {
    default: vi.fn(() => ({
      set: mockSet,
      setex: mockSetex,
      get: mockGet,
      del: mockDel,
      disconnect: mockDisconnect,
      on: mockOn,
    })),
  };
});

// Mock formatError
vi.mock("common/utils", () => ({
  formatError: vi.fn((error: unknown) => {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }),
}));

// Mock logger
vi.mock("common/logger", () => ({
  logger: {
    child: vi.fn(() => ({
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

describe("RedisCache", () => {
  let cache: RedisCache;
  let mockClient: {
    set: Mock;
    setex: Mock;
    get: Mock;
    del: Mock;
    disconnect: Mock;
    on: Mock;
  };
  const config: RedisCacheConfig = {
    provider: "redis",
    host: "localhost",
    port: 6379,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Assign the module-level mocks to mockClient
    mockClient = {
      set: mockSet,
      setex: mockSetex,
      get: mockGet,
      del: mockDel,
      disconnect: mockDisconnect,
      on: mockOn,
    };

    cache = new RedisCache(config);
  });

  describe("Constructor", () => {
    it("should create instance with minimal config", () => {
      expect(cache).toBeInstanceOf(RedisCache);
      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          host: "localhost",
          port: 6379,
          password: undefined,
          db: undefined,
          connectionName: "Pipeline-Cache",
          lazyConnect: false,
          maxRetriesPerRequest: 3,
        }),
      );
      // Verify retryStrategy is a function
      const callArgs = (Redis as unknown as Mock).mock.calls[0][0];
      expect(typeof callArgs.retryStrategy).toBe("function");
    });

    it("should create instance with full config", () => {
      vi.clearAllMocks();

      const fullConfig: RedisCacheConfig = {
        provider: "redis",
        host: "redis.example.com",
        port: 6380,
        password: "secret",
        db: 2,
      };

      const cacheWithFullConfig = new RedisCache(fullConfig);
      expect(cacheWithFullConfig).toBeInstanceOf(RedisCache);

      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          host: "redis.example.com",
          port: 6380,
          password: "secret",
          db: 2,
          connectionName: "Pipeline-Cache",
          lazyConnect: false,
          maxRetriesPerRequest: 3,
        }),
      );
      // Verify retryStrategy is a function
      const callArgs = (Redis as unknown as Mock).mock.calls[0][0];
      expect(typeof callArgs.retryStrategy).toBe("function");
    });

    it("should register error handler", () => {
      expect(mockClient.on).toHaveBeenCalledWith("error", expect.any(Function));
    });

    it("should register connection lifecycle handlers", () => {
      expect(mockClient.on).toHaveBeenCalledWith("error", expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith("ready", expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith(
        "reconnecting",
        expect.any(Function),
      );
      expect(mockClient.on).toHaveBeenCalledWith("close", expect.any(Function));
    });
  });

  describe("set()", () => {
    describe("Success scenarios", () => {
      it("should set a basic string value", async () => {
        mockClient.set.mockResolvedValue("OK");

        await cache.set("test-key", "test-value");

        expect(mockClient.set).toHaveBeenCalledWith("test-key", "test-value");
      });

      it("should set with TTL", async () => {
        mockClient.setex.mockResolvedValue("OK");

        await cache.set("test-key", "test-value", { ttl: 60 });

        expect(mockClient.setex).toHaveBeenCalledWith(
          "test-key",
          60,
          "test-value",
        );
      });

      it("should set without TTL", async () => {
        mockClient.set.mockResolvedValue("OK");

        await cache.set("test-key", "test-value");

        expect(mockClient.set).toHaveBeenCalledWith("test-key", "test-value");
        expect(mockClient.setex).not.toHaveBeenCalled();
      });

      it("should handle large values", async () => {
        mockClient.set.mockResolvedValue("OK");
        const largeValue = "x".repeat(100000);

        await cache.set("large-key", largeValue);

        expect(mockClient.set).toHaveBeenCalledWith("large-key", largeValue);
      });

      it("should handle special characters in keys", async () => {
        mockClient.set.mockResolvedValue("OK");

        await cache.set("key:with:colons", "value");

        expect(mockClient.set).toHaveBeenCalledWith("key:with:colons", "value");
      });

      it("should handle empty string values", async () => {
        mockClient.set.mockResolvedValue("OK");

        await cache.set("empty-key", "");

        expect(mockClient.set).toHaveBeenCalledWith("empty-key", "");
      });

      it("should handle JSON string values", async () => {
        mockClient.set.mockResolvedValue("OK");
        const jsonValue = JSON.stringify({ foo: "bar", nested: { val: 123 } });

        await cache.set("json-key", jsonValue);

        expect(mockClient.set).toHaveBeenCalledWith("json-key", jsonValue);
      });

      it("should handle short TTL values", async () => {
        mockClient.setex.mockResolvedValue("OK");

        await cache.set("test-key", "test-value", { ttl: 10 });

        expect(mockClient.setex).toHaveBeenCalledWith(
          "test-key",
          10,
          "test-value",
        );
      });
    });

    describe("Error scenarios", () => {
      it("should throw CacheSetError on connection error", async () => {
        mockClient.set.mockRejectedValue(new Error("Connection refused"));

        await expect(cache.set("test-key", "test-value")).rejects.toThrow(
          CacheSetError,
        );
        await expect(cache.set("test-key", "test-value")).rejects.toThrow(
          "Set failed for key test-key: Connection refused",
        );
      });

      it("should throw CacheSetError on Redis command error", async () => {
        mockClient.set.mockRejectedValue(new Error("WRONGTYPE"));

        await expect(cache.set("test-key", "test-value")).rejects.toThrow(
          CacheSetError,
        );
      });

      it("should handle string errors", async () => {
        mockClient.set.mockRejectedValue("String error");

        await expect(cache.set("test-key", "test-value")).rejects.toThrow(
          CacheSetError,
        );
      });

      it("should handle object errors", async () => {
        mockClient.set.mockRejectedValue({ message: "Object error" });

        await expect(cache.set("test-key", "test-value")).rejects.toThrow(
          CacheSetError,
        );
      });
    });
  });

  describe("get()", () => {
    describe("Success scenarios", () => {
      it("should retrieve existing key", async () => {
        mockClient.get.mockResolvedValue("test-value");

        const result = await cache.get("test-key");

        expect(result).toBe("test-value");
        expect(mockClient.get).toHaveBeenCalledWith("test-key");
      });

      it("should return null for non-existent key", async () => {
        mockClient.get.mockResolvedValue(null);

        const result = await cache.get("non-existent");

        expect(result).toBeNull();
      });

      it("should handle empty string values", async () => {
        mockClient.get.mockResolvedValue("");

        const result = await cache.get("empty-key");

        expect(result).toBe("");
      });

      it("should retrieve large values", async () => {
        const largeValue = "y".repeat(100000);
        mockClient.get.mockResolvedValue(largeValue);

        const result = await cache.get("large-key");

        expect(result).toBe(largeValue);
      });

      it("should retrieve JSON string values", async () => {
        const jsonValue = JSON.stringify({ foo: "bar" });
        mockClient.get.mockResolvedValue(jsonValue);

        const result = await cache.get("json-key");

        expect(result).toBe(jsonValue);
      });

      it("should handle special characters in keys", async () => {
        mockClient.get.mockResolvedValue("value");

        const result = await cache.get("key:with:colons");

        expect(result).toBe("value");
        expect(mockClient.get).toHaveBeenCalledWith("key:with:colons");
      });
    });

    describe("Error scenarios", () => {
      it("should throw CacheGetError on connection error", async () => {
        mockClient.get.mockRejectedValue(new Error("Connection lost"));

        await expect(cache.get("test-key")).rejects.toThrow(CacheGetError);
        await expect(cache.get("test-key")).rejects.toThrow(
          "Get failed for key test-key: Connection lost",
        );
      });

      it("should throw CacheGetError on Redis command error", async () => {
        mockClient.get.mockRejectedValue(new Error("WRONGTYPE"));

        await expect(cache.get("test-key")).rejects.toThrow(CacheGetError);
      });

      it("should handle string errors", async () => {
        mockClient.get.mockRejectedValue("String error");

        await expect(cache.get("test-key")).rejects.toThrow(CacheGetError);
      });
    });
  });

  describe("delete()", () => {
    describe("Success scenarios", () => {
      it("should delete existing key", async () => {
        mockClient.del.mockResolvedValue(1);

        await cache.delete("test-key");

        expect(mockClient.del).toHaveBeenCalledWith("test-key");
      });

      it("should delete non-existent key without error", async () => {
        mockClient.del.mockResolvedValue(0);

        await cache.delete("non-existent");

        expect(mockClient.del).toHaveBeenCalledWith("non-existent");
      });

      it("should handle special characters in keys", async () => {
        mockClient.del.mockResolvedValue(1);

        await cache.delete("key:with:colons");

        expect(mockClient.del).toHaveBeenCalledWith("key:with:colons");
      });
    });

    describe("Error scenarios", () => {
      it("should throw CacheDeleteError on connection error", async () => {
        mockClient.del.mockRejectedValue(new Error("Connection timeout"));

        await expect(cache.delete("test-key")).rejects.toThrow(
          CacheDeleteError,
        );
        await expect(cache.delete("test-key")).rejects.toThrow(
          "Delete failed for key test-key: Connection timeout",
        );
      });

      it("should throw CacheDeleteError on Redis command error", async () => {
        mockClient.del.mockRejectedValue(new Error("Command failed"));

        await expect(cache.delete("test-key")).rejects.toThrow(
          CacheDeleteError,
        );
      });

      it("should handle string errors", async () => {
        mockClient.del.mockRejectedValue("String error");

        await expect(cache.delete("test-key")).rejects.toThrow(
          CacheDeleteError,
        );
      });
    });
  });

  describe("Integration scenarios", () => {
    it("should set and get a value", async () => {
      mockClient.set.mockResolvedValue("OK");
      mockClient.get.mockResolvedValue("test-value");

      await cache.set("test-key", "test-value");
      const result = await cache.get("test-key");

      expect(result).toBe("test-value");
    });

    it("should set with TTL and get before expiration", async () => {
      mockClient.setex.mockResolvedValue("OK");
      mockClient.get.mockResolvedValue("test-value");

      await cache.set("test-key", "test-value", { ttl: 60 });
      const result = await cache.get("test-key");

      expect(result).toBe("test-value");
      expect(mockClient.setex).toHaveBeenCalledWith(
        "test-key",
        60,
        "test-value",
      );
    });

    it("should set, delete, and verify deletion", async () => {
      mockClient.set.mockResolvedValue("OK");
      mockClient.del.mockResolvedValue(1);
      mockClient.get.mockResolvedValue(null);

      await cache.set("test-key", "test-value");
      await cache.delete("test-key");
      const result = await cache.get("test-key");

      expect(result).toBeNull();
    });

    it("should handle multiple sequential operations", async () => {
      mockClient.set.mockResolvedValue("OK");
      mockClient.get.mockResolvedValueOnce("value1");
      mockClient.get.mockResolvedValueOnce("value2");

      await cache.set("key1", "value1");
      await cache.set("key2", "value2");

      const result1 = await cache.get("key1");
      const result2 = await cache.get("key2");

      expect(result1).toBe("value1");
      expect(result2).toBe("value2");
    });

    it("should overwrite existing key", async () => {
      mockClient.set.mockResolvedValue("OK");
      mockClient.get.mockResolvedValueOnce("old-value");
      mockClient.get.mockResolvedValueOnce("new-value");

      await cache.set("test-key", "old-value");
      const oldValue = await cache.get("test-key");
      await cache.set("test-key", "new-value");
      const newValue = await cache.get("test-key");

      expect(oldValue).toBe("old-value");
      expect(newValue).toBe("new-value");
    });
  });

  describe("Edge cases", () => {
    it("should handle very long keys", async () => {
      mockClient.set.mockResolvedValue("OK");
      const longKey = "k".repeat(1000);

      await cache.set(longKey, "value");

      expect(mockClient.set).toHaveBeenCalledWith(longKey, "value");
    });

    it("should handle unicode in keys", async () => {
      mockClient.set.mockResolvedValue("OK");

      await cache.set("key-with-émojis-🎉", "value");

      expect(mockClient.set).toHaveBeenCalledWith(
        "key-with-émojis-🎉",
        "value",
      );
    });

    it("should handle unicode in values", async () => {
      mockClient.set.mockResolvedValue("OK");

      await cache.set("test-key", "value-with-émojis-🎉");

      expect(mockClient.set).toHaveBeenCalledWith(
        "test-key",
        "value-with-émojis-🎉",
      );
    });

    it("should handle newlines in values", async () => {
      mockClient.set.mockResolvedValue("OK");

      await cache.set("test-key", "line1\nline2\nline3");

      expect(mockClient.set).toHaveBeenCalledWith(
        "test-key",
        "line1\nline2\nline3",
      );
    });

    it("should handle special JSON characters", async () => {
      mockClient.set.mockResolvedValue("OK");
      const jsonWithSpecialChars = JSON.stringify({
        quotes: "both \"double\" and 'single'",
        backslash: "\\",
        newline: "\n",
      });

      await cache.set("json-key", jsonWithSpecialChars);

      expect(mockClient.set).toHaveBeenCalledWith(
        "json-key",
        jsonWithSpecialChars,
      );
    });

    it("should handle keys with slashes", async () => {
      mockClient.set.mockResolvedValue("OK");

      await cache.set("path/to/key", "value");

      expect(mockClient.set).toHaveBeenCalledWith("path/to/key", "value");
    });

    it("should handle keys with spaces", async () => {
      mockClient.set.mockResolvedValue("OK");

      await cache.set("key with spaces", "value");

      expect(mockClient.set).toHaveBeenCalledWith("key with spaces", "value");
    });
  });

  describe("Error type verification", () => {
    it("should throw CacheSetError with correct properties", async () => {
      mockClient.set.mockRejectedValue(new Error("Test error"));

      try {
        await cache.set("test-key", "test-value");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(CacheSetError);
        expect((error as CacheSetError).key).toBe("test-key");
        expect((error as CacheSetError).reason).toBe("Test error");
      }
    });

    it("should throw CacheGetError with correct properties", async () => {
      mockClient.get.mockRejectedValue(new Error("Test error"));

      try {
        await cache.get("test-key");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(CacheGetError);
        expect((error as CacheGetError).key).toBe("test-key");
        expect((error as CacheGetError).reason).toBe("Test error");
      }
    });

    it("should throw CacheDeleteError with correct properties", async () => {
      mockClient.del.mockRejectedValue(new Error("Test error"));

      try {
        await cache.delete("test-key");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(CacheDeleteError);
        expect((error as CacheDeleteError).key).toBe("test-key");
        expect((error as CacheDeleteError).reason).toBe("Test error");
      }
    });
  });
});
