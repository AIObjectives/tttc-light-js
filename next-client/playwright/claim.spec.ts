import { test as base, Locator, expect } from "@playwright/test";

const baseUrl = new URL("http://localhost:3000");

const reportBaseUrl = new URL("/report/", baseUrl);

const testReportUrl = new URL(
  "https%3A%2F%2Fstorage.googleapis.com%2Ftttc-light-dev%2Ftest%2520longer%2520report-1740686953925.json",
  reportBaseUrl,
);

/**
 * Fixture - sets up the claim we want to test
 */
const test = base.extend<{ claim: Locator }>({
  claim: async ({ page }, use) => {
    await page.goto(testReportUrl.toString());

    await page.waitForLoadState("networkidle");
    const firstTopic = page.locator('[data-testid="topic-item"]').first();
    await firstTopic.getByRole("button", { name: "Expand Topic" }).click();

    const claim = firstTopic.locator('[data-testid="claim-item"]').first();

    use(claim);
  },
});

/**
 * Pressing copies url for subtopic
 */
test("Pressing copies url for subtopic", async ({
  claim,
  browserName,
  page,
}) => {
  // Test can only run on Chromium
  test.skip(
    browserName !== "chromium",
    "Skipping... Clipboard only works in Chromium",
  );

  const expectedLink =
    "http://localhost:3000/report/https%3A%2F%2Fstorage.googleapis.com%2Ftttc-light-dev%2Ftest%2520longer%2520report-1740686953925.json#Fine-tuning%20AI%20models%20can%20significantly%20enhance%20their%20performance.";

  // Get the copy link button
  const copyButton = claim.locator('[data-testid="copybutton"]').first();

  expect(copyButton).toBeDefined();

  // Click it
  await copyButton.click();

  // Get text saved to clipboard
  const clipboardValue = await page
    .evaluateHandle(() => navigator.clipboard.readText())
    .then((val) => val.jsonValue());

  expect(clipboardValue).toBe(expectedLink);
});
