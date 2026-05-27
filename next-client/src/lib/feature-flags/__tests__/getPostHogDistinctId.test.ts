import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPostHogDistinctId } from "../getPostHogDistinctId";

vi.mock("tttc-common/logger", () => ({
  logger: {
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

const { mockCookies } = vi.hoisted(() => ({
  mockCookies: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

function setCookies(entries: Array<{ name: string; value: string }>) {
  mockCookies.mockResolvedValue({
    getAll: () => entries,
  });
}

describe("getPostHogDistinctId", () => {
  beforeEach(() => {
    mockCookies.mockReset();
  });

  it("returns the distinct_id from a URL-encoded PostHog cookie", async () => {
    const state = { distinct_id: "user-abc123", $device_id: "device-xyz" };
    setCookies([
      {
        name: "ph_phc_PROJECT_KEY_posthog",
        value: encodeURIComponent(JSON.stringify(state)),
      },
    ]);

    expect(await getPostHogDistinctId()).toBe("user-abc123");
  });

  it("parses a raw JSON cookie value (not URI-encoded)", async () => {
    setCookies([
      {
        name: "ph_phc_PROJECT_KEY_posthog",
        value: JSON.stringify({ distinct_id: "plain-id" }),
      },
    ]);

    expect(await getPostHogDistinctId()).toBe("plain-id");
  });

  it("returns undefined when no PostHog cookie is present", async () => {
    setCookies([{ name: "session", value: "abc" }]);
    expect(await getPostHogDistinctId()).toBeUndefined();
  });

  it("returns undefined when the cookie is malformed JSON", async () => {
    setCookies([
      { name: "ph_key_posthog", value: encodeURIComponent("not-json{{{") },
    ]);
    expect(await getPostHogDistinctId()).toBeUndefined();
  });

  it("returns undefined when distinct_id field is missing", async () => {
    setCookies([
      {
        name: "ph_key_posthog",
        value: encodeURIComponent(JSON.stringify({ $device_id: "d" })),
      },
    ]);
    expect(await getPostHogDistinctId()).toBeUndefined();
  });

  it("returns undefined when distinct_id is empty", async () => {
    setCookies([
      {
        name: "ph_key_posthog",
        value: encodeURIComponent(JSON.stringify({ distinct_id: "" })),
      },
    ]);
    expect(await getPostHogDistinctId()).toBeUndefined();
  });

  it("ignores other cookies and only matches ph_*_posthog", async () => {
    setCookies([
      { name: "ph_session", value: "x" },
      { name: "posthog", value: "y" },
      {
        name: "ph_real_posthog",
        value: encodeURIComponent(JSON.stringify({ distinct_id: "real" })),
      },
    ]);

    expect(await getPostHogDistinctId()).toBe("real");
  });
});
