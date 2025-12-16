/**
 * monday.com CRM Integration Service
 *
 * Handles syncing user profile data to monday.com boards via GraphQL API.
 *
 * Architecture:
 * - Async background syncing (non-blocking for user auth/profile updates)
 * - Graceful error handling (monday.com failures don't break user flows)
 * - Rate limit aware (60 req/min per account)
 * - Exponential backoff for 429 rate limit errors
 *
 * Authentication:
 * Uses a service account's personal API token (MONDAY_API_TOKEN).
 * The service account is a "Member" user with access ONLY to the CRM board,
 * so the token's permissions are limited to that board.
 *
 * Environment Variables:
 * - MONDAY_API_TOKEN: API token for monday.com authentication
 * - MONDAY_BOARD_ID: Target board ID for CRM entries
 * - MONDAY_COLUMN_IDS: JSON object mapping field names to column IDs
 *   Example: {"email":"email_xxx","company":"text_xxx",...}
 */

import { logger } from "tttc-common/logger";
import { z } from "zod";

const mondayLogger = logger.child({ module: "monday" });

/**
 * Retry configuration for exponential backoff
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function getRetryDelay(attempt: number): number {
  const exponentialDelay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
  return Math.min(exponentialDelay + jitter, RETRY_CONFIG.maxDelayMs);
}

/**
 * Execute a fetch request with exponential backoff retry for 429 errors
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  context: string,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Retry on 429 rate limit errors
      if (response.status === 429 && attempt < RETRY_CONFIG.maxRetries) {
        const delay = getRetryDelay(attempt);
        mondayLogger.warn(
          { attempt: attempt + 1, delayMs: delay, context },
          "monday.com rate limited (429), retrying with backoff",
        );
        await sleep(delay);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Network errors - retry with backoff
      if (attempt < RETRY_CONFIG.maxRetries) {
        const delay = getRetryDelay(attempt);
        mondayLogger.warn(
          { attempt: attempt + 1, delayMs: delay, error: lastError, context },
          "monday.com request failed, retrying with backoff",
        );
        await sleep(delay);
        continue;
      }
    }
  }

  throw lastError || new Error("Request failed after retries");
}

/**
 * User profile data to sync to monday.com
 * Maps to existing monday.com board columns
 */
export interface MondayUserProfile {
  // Existing columns in monday.com board
  displayName: string; // → Lead column
  email: string; // → Email column
  company?: string; // → Company column
  title?: string; // → Title column
  phone?: string; // → Phone column
  useCase?: string; // → Use Case column
  newsletterOptIn?: boolean; // → Newsletter Opt-in column (checkbox)
}

/**
 * Schema for monday.com column IDs configuration
 * Validates the JSON structure from MONDAY_COLUMN_IDS env var
 */
const columnIdsSchema = z.object({
  email: z.string(),
  company: z.string(),
  title: z.string(),
  phone: z.string(),
  useCase: z.string(),
  newsletterOptIn: z.string(),
});

type ColumnIds = z.infer<typeof columnIdsSchema>;

/**
 * Cached column IDs after parsing from environment
 */
let cachedColumnIds: ColumnIds | null = null;

/**
 * In-memory tracking of pending create operations per email
 * Prevents race conditions when multiple calls try to create items for the same email
 * Note: This works within a single instance; cross-instance races are handled by findMondayItemByEmail
 */
const pendingCreates = new Map<string, Promise<string | null>>();

/**
 * Get column IDs from environment variable
 * Parses MONDAY_COLUMN_IDS JSON and validates structure
 * @throws Error if MONDAY_COLUMN_IDS is missing or invalid
 */
function getColumnIds(): ColumnIds {
  if (cachedColumnIds) {
    return cachedColumnIds;
  }

  const columnIdsJson = process.env.MONDAY_COLUMN_IDS;
  if (!columnIdsJson) {
    throw new Error(
      "MONDAY_COLUMN_IDS environment variable is required for monday.com integration",
    );
  }

  try {
    const parsed = JSON.parse(columnIdsJson);
    cachedColumnIds = columnIdsSchema.parse(parsed);
    return cachedColumnIds;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid MONDAY_COLUMN_IDS format: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
      );
    }
    throw new Error(
      `Failed to parse MONDAY_COLUMN_IDS: ${error instanceof Error ? error.message : "Invalid JSON"}`,
    );
  }
}

/**
 * Validate monday.com environment configuration
 * @throws Error if required environment variables are missing
 */
function validateMondayConfig(): void {
  if (!process.env.MONDAY_API_TOKEN) {
    throw new Error(
      "MONDAY_API_TOKEN environment variable is required for monday.com integration",
    );
  }
  if (!process.env.MONDAY_BOARD_ID) {
    throw new Error(
      "MONDAY_BOARD_ID environment variable is required for monday.com integration",
    );
  }
  // This will throw if column IDs are missing or invalid
  getColumnIds();
}

/**
 * Check if monday.com integration is enabled
 * Integration is enabled if API token, board ID, and column IDs are configured
 */
export function isMondayEnabled(): boolean {
  return !!(
    process.env.MONDAY_API_TOKEN &&
    process.env.MONDAY_BOARD_ID &&
    process.env.MONDAY_COLUMN_IDS
  );
}

/**
 * Build monday.com column values object for GraphQL mutation
 * Returns raw object - caller handles serialization for GraphQL variables
 */
function buildColumnValues(
  profile: MondayUserProfile,
): Record<string, unknown> {
  const columnIds = getColumnIds();
  const columnValues: Record<string, unknown> = {};

  // Required fields
  if (profile.email) {
    columnValues[columnIds.email] = {
      email: profile.email,
      text: profile.email,
    };
  }

  // Optional text fields
  if (profile.company) {
    columnValues[columnIds.company] = profile.company;
  }
  if (profile.title) {
    columnValues[columnIds.title] = profile.title;
  }
  if (profile.phone) {
    columnValues[columnIds.phone] = profile.phone;
  }
  if (profile.useCase) {
    columnValues[columnIds.useCase] = profile.useCase;
  }

  // Newsletter opt-in checkbox - only include if explicitly provided
  // This prevents accidentally resetting subscription status on updates
  if (profile.newsletterOptIn !== undefined) {
    columnValues[columnIds.newsletterOptIn] = {
      checked: profile.newsletterOptIn,
    };
  }

  return columnValues;
}

/**
 * Create a new item in monday.com board
 *
 * @param profile User profile data to sync
 * @returns Promise that resolves when sync completes (or fails gracefully)
 *
 * @remarks
 * - Non-blocking: Errors are logged but not thrown
 * - Item name is set to displayName (shows in "Lead" column)
 * - All other fields are set via column_values parameter
 * - Automatically updates existing item if email already exists (upsert behavior)
 */
export async function createMondayItem(
  profile: MondayUserProfile,
): Promise<void> {
  // Skip if monday.com integration is not configured
  if (!isMondayEnabled()) {
    mondayLogger.debug(
      "monday.com integration is disabled (missing API token or board ID)",
    );
    return;
  }

  try {
    validateMondayConfig();

    // Check if there's already a pending create for this email (race condition prevention)
    const pendingCreate = pendingCreates.get(profile.email);
    if (pendingCreate) {
      mondayLogger.info(
        { email: profile.email },
        "Waiting for pending monday.com create to complete",
      );
      const itemId = await pendingCreate;
      if (itemId) {
        mondayLogger.info(
          { email: profile.email, itemId },
          "Pending create completed, updating item instead",
        );
        return updateMondayItem(itemId, profile);
      }
      // If pending create failed/returned null, fall through to try again
    }

    // Check if user already exists - update instead of creating duplicate
    const existingItemId = await findMondayItemByEmail(profile.email);
    if (existingItemId) {
      mondayLogger.info(
        { email: profile.email, itemId: existingItemId },
        "User already exists in monday.com, updating instead of creating duplicate",
      );
      return updateMondayItem(existingItemId, profile);
    }

    const columnValues = buildColumnValues(profile);

    // Use GraphQL variables to prevent injection attacks
    const mutation = `
      mutation CreateItem($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
        create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) {
          id
        }
      }
    `;

    mondayLogger.info(
      { displayName: profile.displayName, email: profile.email },
      "Creating monday.com item",
    );

    // Track this create operation to prevent race conditions
    const createPromise = (async (): Promise<string | null> => {
      try {
        const response = await fetchWithRetry(
          "https://api.monday.com/v2",
          {
            method: "POST",
            headers: {
              Authorization: process.env.MONDAY_API_TOKEN!,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query: mutation,
              variables: {
                boardId: process.env.MONDAY_BOARD_ID,
                itemName: profile.displayName,
                columnValues: JSON.stringify(columnValues),
              },
            }),
          },
          "createMondayItem",
        );

        if (!response.ok) {
          throw new Error(
            `monday.com API HTTP error: ${response.status} ${response.statusText}`,
          );
        }

        const result = await response.json();

        // Check for GraphQL errors (HTTP 200 but query failed)
        if (result.errors) {
          throw new Error(
            `monday.com GraphQL error: ${JSON.stringify(result.errors)}`,
          );
        }

        const itemId = result.data?.create_item?.id;
        mondayLogger.info(
          {
            itemId,
            displayName: profile.displayName,
            email: profile.email,
          },
          "monday.com item created successfully",
        );
        return itemId || null;
      } catch (error) {
        mondayLogger.error(
          {
            error,
            profile: {
              displayName: profile.displayName,
              email: profile.email,
              hasCompany: !!profile.company,
              hasUseCase: !!profile.useCase,
            },
          },
          "Failed to create monday.com item",
        );
        return null;
      }
    })();

    pendingCreates.set(profile.email, createPromise);
    try {
      await createPromise;
    } finally {
      pendingCreates.delete(profile.email);
    }
  } catch (error) {
    // Log error but don't throw - monday.com sync is non-critical
    mondayLogger.error(
      {
        error,
        profile: {
          displayName: profile.displayName,
          email: profile.email,
          hasCompany: !!profile.company,
          hasUseCase: !!profile.useCase,
        },
      },
      "Failed to create monday.com item",
    );
  }
}

/**
 * Update an existing item in monday.com board
 *
 * @param itemId monday.com item ID to update
 * @param updates Partial profile data to update
 *
 * @remarks
 * - Called by createMondayItem when email already exists (upsert behavior)
 * - Uses parameterized GraphQL queries to prevent injection attacks
 */
export async function updateMondayItem(
  itemId: string,
  updates: Partial<MondayUserProfile>,
): Promise<void> {
  if (!isMondayEnabled()) {
    mondayLogger.debug(
      "monday.com integration is disabled (missing API token or board ID)",
    );
    return;
  }

  try {
    validateMondayConfig();

    const columnValues = buildColumnValues(updates as MondayUserProfile);

    // Use GraphQL variables to prevent injection attacks
    const mutation = `
      mutation UpdateItem($itemId: ID!, $boardId: ID!, $columnValues: JSON!) {
        change_multiple_column_values(item_id: $itemId, board_id: $boardId, column_values: $columnValues) {
          id
        }
      }
    `;

    mondayLogger.info({ itemId, updates }, "Updating monday.com item");

    const response = await fetchWithRetry(
      "https://api.monday.com/v2",
      {
        method: "POST",
        headers: {
          Authorization: process.env.MONDAY_API_TOKEN!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: mutation,
          variables: {
            itemId,
            boardId: process.env.MONDAY_BOARD_ID,
            columnValues: JSON.stringify(columnValues),
          },
        }),
      },
      "updateMondayItem",
    );

    if (!response.ok) {
      throw new Error(
        `monday.com API HTTP error: ${response.status} ${response.statusText}`,
      );
    }

    const result = await response.json();

    if (result.errors) {
      throw new Error(
        `monday.com GraphQL error: ${JSON.stringify(result.errors)}`,
      );
    }

    mondayLogger.info({ itemId }, "monday.com item updated successfully");
  } catch (error) {
    mondayLogger.error(
      {
        error,
        itemId,
        updates,
      },
      "Failed to update monday.com item",
    );
  }
}

/**
 * Query monday.com for existing item by email
 * Useful for preventing duplicate entries
 *
 * @param email User email to search for
 * @returns monday.com item ID if found, null otherwise
 */
export async function findMondayItemByEmail(
  email: string,
): Promise<string | null> {
  if (!isMondayEnabled()) {
    mondayLogger.debug(
      "monday.com integration is disabled (missing API token or board ID)",
    );
    return null;
  }

  try {
    validateMondayConfig();
    const columnIds = getColumnIds();

    // Use GraphQL variables to prevent injection attacks
    const query = `
      query FindByEmail($boardId: ID!, $columnId: String!, $columnValue: String!) {
        items_page_by_column_values(board_id: $boardId, limit: 1, columns: [{column_id: $columnId, column_values: [$columnValue]}]) {
          items {
            id
            name
          }
        }
      }
    `;

    const response = await fetchWithRetry(
      "https://api.monday.com/v2",
      {
        method: "POST",
        headers: {
          Authorization: process.env.MONDAY_API_TOKEN!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          variables: {
            boardId: process.env.MONDAY_BOARD_ID,
            columnId: columnIds.email,
            columnValue: email,
          },
        }),
      },
      "findMondayItemByEmail",
    );

    if (!response.ok) {
      throw new Error(
        `monday.com API HTTP error: ${response.status} ${response.statusText}`,
      );
    }

    const result = await response.json();

    if (result.errors) {
      throw new Error(
        `monday.com GraphQL error: ${JSON.stringify(result.errors)}`,
      );
    }

    const items = result.data?.items_page_by_column_values?.items || [];
    return items.length > 0 ? items[0].id : null;
  } catch (error) {
    mondayLogger.error(
      {
        error,
        email,
      },
      "Failed to query monday.com for existing item",
    );
    return null;
  }
}
