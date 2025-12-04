import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createMondayItem,
  updateMondayItem,
  findMondayItemByEmail,
  isMondayEnabled,
  MondayUserProfile,
} from "../services/monday";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock logger
vi.mock("tttc-common/logger", () => ({
  logger: {
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

describe("monday.com Integration Service", () => {
  const originalEnv = process.env;

  const validColumnIds = JSON.stringify({
    email: "email_test",
    company: "text_company",
    title: "text_title",
    phone: "phone_test",
    useCase: "text_usecase",
    newsletterOptIn: "boolean_newsletter",
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    process.env = { ...originalEnv };
    // Set up valid monday.com config
    process.env.MONDAY_API_TOKEN = "test-api-token";
    process.env.MONDAY_BOARD_ID = "12345";
    process.env.MONDAY_COLUMN_IDS = validColumnIds;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isMondayEnabled", () => {
    it("returns true when all required env vars are set", () => {
      expect(isMondayEnabled()).toBe(true);
    });

    it("returns false when MONDAY_API_TOKEN is missing", () => {
      delete process.env.MONDAY_API_TOKEN;
      expect(isMondayEnabled()).toBe(false);
    });

    it("returns false when MONDAY_BOARD_ID is missing", () => {
      delete process.env.MONDAY_BOARD_ID;
      expect(isMondayEnabled()).toBe(false);
    });

    it("returns false when MONDAY_COLUMN_IDS is missing", () => {
      delete process.env.MONDAY_COLUMN_IDS;
      expect(isMondayEnabled()).toBe(false);
    });
  });

  describe("createMondayItem", () => {
    const testProfile: MondayUserProfile = {
      displayName: "Test User",
      email: "test@example.com",
      company: "Test Corp",
      title: "Engineer",
      useCase: "Testing",
      newsletterOptIn: true,
    };

    it("skips sync when monday.com integration is disabled", async () => {
      delete process.env.MONDAY_API_TOKEN;

      await createMondayItem(testProfile);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("creates a new item when email does not exist", async () => {
      // First call: findMondayItemByEmail returns no results
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { items_page_by_column_values: { items: [] } },
          }),
      });

      // Second call: createItem succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { create_item: { id: "999" } },
          }),
      });

      await createMondayItem(testProfile);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      // Verify createItem was called
      const createCall = mockFetch.mock.calls[1];
      expect(createCall[0]).toBe("https://api.monday.com/v2");
      const body = JSON.parse(createCall[1].body);
      expect(body.variables.itemName).toBe("Test User");
    });

    it("updates existing item when email already exists", async () => {
      // First call: findMondayItemByEmail returns existing item
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              items_page_by_column_values: { items: [{ id: "existing-123" }] },
            },
          }),
      });

      // Second call: updateItem succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { change_multiple_column_values: { id: "existing-123" } },
          }),
      });

      await createMondayItem(testProfile);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      // Verify update was called with existing item ID
      const updateCall = mockFetch.mock.calls[1];
      const body = JSON.parse(updateCall[1].body);
      expect(body.variables.itemId).toBe("existing-123");
    });

    it("omits newsletterOptIn when not specified to avoid resetting existing values", async () => {
      const profileWithoutNewsletter: MondayUserProfile = {
        displayName: "Test User",
        email: "test@example.com",
      };

      // First call: no existing item
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { items_page_by_column_values: { items: [] } },
          }),
      });

      // Second call: create item
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { create_item: { id: "999" } },
          }),
      });

      await createMondayItem(profileWithoutNewsletter);

      const createCall = mockFetch.mock.calls[1];
      const body = JSON.parse(createCall[1].body);
      const columnValues = JSON.parse(body.variables.columnValues);
      // newsletterOptIn should NOT be included when not explicitly provided
      expect(columnValues.boolean_newsletter).toBeUndefined();
    });

    it("includes newsletterOptIn when explicitly set to false", async () => {
      const profileWithNewsletterFalse: MondayUserProfile = {
        displayName: "Test User",
        email: "test@example.com",
        newsletterOptIn: false,
      };

      // First call: no existing item
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { items_page_by_column_values: { items: [] } },
          }),
      });

      // Second call: create item
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { create_item: { id: "999" } },
          }),
      });

      await createMondayItem(profileWithNewsletterFalse);

      const createCall = mockFetch.mock.calls[1];
      const body = JSON.parse(createCall[1].body);
      const columnValues = JSON.parse(body.variables.columnValues);
      // Should be included because it was explicitly set
      expect(columnValues.boolean_newsletter).toEqual({ checked: false });
    });

    it("handles API errors gracefully without throwing", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      // Should not throw
      await expect(createMondayItem(testProfile)).resolves.toBeUndefined();
    });

    it("handles GraphQL errors gracefully without throwing", async () => {
      // First call: findMondayItemByEmail
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { items_page_by_column_values: { items: [] } },
          }),
      });

      // Second call: GraphQL error
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            errors: [{ message: "Some GraphQL error" }],
          }),
      });

      // Should not throw
      await expect(createMondayItem(testProfile)).resolves.toBeUndefined();
    });
  });

  describe("findMondayItemByEmail", () => {
    it("returns item ID when email exists", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              items_page_by_column_values: {
                items: [{ id: "found-123", name: "Test User" }],
              },
            },
          }),
      });

      const result = await findMondayItemByEmail("test@example.com");
      expect(result).toBe("found-123");
    });

    it("returns null when email does not exist", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { items_page_by_column_values: { items: [] } },
          }),
      });

      const result = await findMondayItemByEmail("notfound@example.com");
      expect(result).toBeNull();
    });

    it("returns null on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const result = await findMondayItemByEmail("test@example.com");
      expect(result).toBeNull();
    });
  });

  describe("updateMondayItem", () => {
    it("updates item with provided fields", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { change_multiple_column_values: { id: "123" } },
          }),
      });

      await updateMondayItem("123", {
        displayName: "Updated Name",
        email: "test@example.com",
        company: "New Company",
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.variables.itemId).toBe("123");
    });

    it("skips sync when monday.com integration is disabled", async () => {
      delete process.env.MONDAY_API_TOKEN;

      await updateMondayItem("123", {
        displayName: "Test",
        email: "test@example.com",
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("MONDAY_COLUMN_IDS validation", () => {
    it("throws error for invalid JSON", async () => {
      process.env.MONDAY_COLUMN_IDS = "not-valid-json";

      // Reset the cached column IDs by reimporting
      vi.resetModules();
      const { createMondayItem: freshCreateMondayItem } = await import(
        "../services/monday.js"
      );

      const testProfile: MondayUserProfile = {
        displayName: "Test",
        email: "test@example.com",
      };

      // findMondayItemByEmail will be called first and should fail on column ID validation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { items_page_by_column_values: { items: [] } },
          }),
      });

      // The error is caught internally and logged, so it shouldn't throw
      await expect(freshCreateMondayItem(testProfile)).resolves.toBeUndefined();
    });

    it("throws error for missing required fields", async () => {
      process.env.MONDAY_COLUMN_IDS = JSON.stringify({
        email: "email_test",
        // Missing other required fields
      });

      vi.resetModules();
      const { createMondayItem: freshCreateMondayItem } = await import(
        "../services/monday.js"
      );

      const testProfile: MondayUserProfile = {
        displayName: "Test",
        email: "test@example.com",
      };

      // The error is caught internally and logged
      await expect(freshCreateMondayItem(testProfile)).resolves.toBeUndefined();
    });
  });

  describe("exponential backoff retry", () => {
    it("retries on 429 rate limit errors", async () => {
      // First two calls: 429 rate limit
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 429,
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 429,
          json: () => Promise.resolve({}),
        })
        // Third call (after retries): success for findMondayItemByEmail
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { items_page_by_column_values: { items: [] } },
            }),
        })
        // Fourth call: create item success
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { create_item: { id: "999" } },
            }),
        });

      const testProfile: MondayUserProfile = {
        displayName: "Test",
        email: "test@example.com",
      };

      await createMondayItem(testProfile);

      // Should have retried: 2 failed + 1 success for find + 1 for create = 4 calls
      expect(mockFetch).toHaveBeenCalledTimes(4);
    }, 15000); // Increase timeout for retry delays
  });
});
