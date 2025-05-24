import { test, expect } from "@playwright/test";
import {
  defaultSubtopicPagination,
  defaultTopicPagination,
} from "@/components/report/hooks/useReportState/consts";
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
 * Copy link from topic component
 */
test("Copy link from topic component", async ({ page, browserName }) => {
  // Should only test on Chromium
  test.skip(
    browserName !== "chromium",
    "Skipping... Clipboard only works in Chromium",
  );

  // The link we expect to see
  const expectedLink =
    "http://localhost:3000/report/https%3A%2F%2Fstorage.googleapis.com%2Ftttc-light-dev%2Ftest%2520longer%2520report-1740686953925.json#Technological%20Advancement";
  // Get the first topic
  const topic = page.locator('[data-testid="topic-item"]').first();

  // Get its copy button
  const copyButton = topic.locator('[data-testid="copybutton"]');

  // Click on it
  await copyButton.click();

  // Get the string copied to the clipboard
  const clipboardContent = await page
    .evaluateHandle(() => navigator.clipboard.readText())
    .then((val) => val.jsonValue());
  // They should be the same
  expect(clipboardContent).toBe(expectedLink);
});

/**
 * Shows correct number of subtopics and claims when "open topic" button is clicked
 */
test('Shows correct number of subtopics and claims when "open topic" button is clicked', async ({
  page,
}) => {
  // How many subtopics we expect to see. (defaultTopicPagination is indexed at 0)
  const expectedSubtopicCount = defaultTopicPagination + 1;
  // How many claims we expect to see. Which is the number of subtopics * claims in each subtopic
  const expectedClaimsCount =
    (defaultSubtopicPagination + 1) * expectedSubtopicCount;

  // Ensure that none are showing to start
  expect(await page.locator('[data-testid="subtopic-item"]').count()).toBe(0);
  expect(await page.locator('[data-testid="claim-item"]').count()).toBe(0);

  // Click the "open topic" button
  await page.locator('[data-testid="open-topic-button"]').first().click();

  // Wait for subtopics to appear
  await expect(
    page.locator('[data-testid="show-more-subtopics-button"]'),
  ).toBeVisible();

  // Count the number of subtopics
  expect(await page.locator('[data-testid="subtopic-item"]').count()).toBe(
    expectedSubtopicCount,
  );

  // Count number of claims. We use :visible here since they are still rendering (for now) in the DOM
  expect(await page.locator('[data-testid="claim-item"]:visible').count()).toBe(
    expectedClaimsCount,
  );
});

/**
 * Shows hover card when hovering over point graphic
 */
test("Shows hover card when hovering over point graphic", async ({ page }) => {
  // Make sure the quote card isn't visible to start with.
  expect(await page.locator('[data-testid="quotecard"]').isVisible()).toBe(
    false,
  );
  // Hover over the point graphic
  await page.locator('[data-testid="point-graphic-cell"]').first().hover();

  // Check if hover card is visible
  const hoverCard = page.locator('[data-testid="quotecard"]');
  await expect(hoverCard).toBeVisible();

  // Check for content
  expect(await hoverCard.textContent()).toBeTruthy();
});

/**
 * Hovering over subtopic list item causes a section of the point graphic cells to highlight
 */
test("Hovering over subtopic list item causes a section of the point graphic cells to highlight", async ({
  page,
}) => {
  // Get a topic
  const topic = page.locator('[data-testid="topic-item"]').first();

  // Get one of the listed subtopic items
  const subtopicListItem = topic
    .locator('[data-testid="subtopic-list-item"]')
    .first();

  // Get the first cell in the point graphic. It should be related to the subtopicListItem above
  const cell = topic.locator('[data-testid="point-graphic-cell"]').first();

  // Get the default color. Returns string rbg(x,x,x)
  const initialColor = await cell.evaluate((el) => {
    return window.getComputedStyle(el).backgroundColor;
  });

  // Hover over the list item
  await subtopicListItem.hover();
  await page.waitForTimeout(100);

  // Get the cell's new color
  const hoverColor = await cell.evaluate((el) => {
    return window.getComputedStyle(el).backgroundColor;
  });

  // We should see that it changed.
  expect(hoverColor).not.toBe(initialColor);
});
