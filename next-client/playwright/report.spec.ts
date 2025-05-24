import { test, expect } from "@playwright/test";

const baseUrl = new URL("http://localhost:3000");

const reportBaseUrl = new URL("/report/", baseUrl);

const testReportUrl = new URL(
  "https%3A%2F%2Fstorage.googleapis.com%2Ftttc-light-dev%2Ftest%2520longer%2520report-1740686953925.json",
  reportBaseUrl,
);

test.beforeEach(async ({ page }) => {
  await page.goto(testReportUrl.toString());

  await page.waitForLoadState("networkidle");
});

/**
 * Report loads and show topic titles
 */
test("Report loads and show topic titles", async ({ page }) => {
  // for this link, we should expect to see these topics
  const expectedTitles = [
    "Technological Advancement",
    "Public Perception and Ethics",
    "AI Alignment",
    "AI Safety",
    "Policy and Governance",
  ];

  // Check if the topic title is correct
  const topicTitles = await page
    .locator('[data-testid="topic-title"]')
    .allTextContents();

  expect(topicTitles).toEqual(expectedTitles);
});
/**
 * "Open all" button expands all topics, subtopics, and claims
 */
test('"Open all" button expands all topics, subtopics, and claims', async ({
  page,
}) => {
  // Test to make sure that claims and subtopics are not shown to start with
  expect(await page.locator('[data-testid="claim-item"]:visible').count()).toBe(
    0,
  );
  expect(await page.locator('[data-testid="subtopic-item"]').count()).toBe(0);

  // Click the "open all" button
  await page.click('[data-testid="open-all-button"]');

  // Wait for animations or transitions to complete (adjust timeout as needed)
  await page.waitForTimeout(500);

  // Test that subtopics and claims are now shown.
  expect(
    await page.locator('[data-testid="subtopic-item"]').count(),
  ).toBeGreaterThan(0);
  expect(
    await page.locator('[data-testid="claim-item"]:visible').count(),
  ).toBeGreaterThan(0);

  // If every subtopic and claim is shown, then these buttons should not appear
  await expect(
    page.locator('[data-testid="show-more-subtopics"]'),
  ).not.toBeVisible();
  await expect(
    page.locator('[data-testid="show-more-claims"]'),
  ).not.toBeVisible();
});
