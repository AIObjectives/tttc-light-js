import { expect, Locator, test } from "@playwright/test";

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
 * Clicking on outline item causes a scroll event
 */
test("Clicking on outline item causes a scroll event", async ({ page }) => {
  // Make sure we're at the top of the page
  await page.evaluate(() => window.scrollTo(0, 0));

  // Get outline item. Make it the last one.
  const outlineItem = page
    .locator('[data-testid="outline-item-clickable"]')
    .last();

  // Get the last topic. It should be the same topic as that the outline item points to
  const lastTopic = page.locator('[data-testid="topic-item"]').last();

  // Make sure that the topic isn't in the viewport to start with
  await expect(lastTopic).not.toBeInViewport();

  // Click on the outline item
  await outlineItem.click();

  // The last topic should now be in the viewport, implying it scrolled to it.
  await expect(lastTopic).toBeInViewport();
});

/**
 * Hovering over an outline item changes its color
 */
test("Hovering over an outline item changes its color", async ({ page }) => {
  // Get outline item
  const outlineItem = page.locator('[data-testid="outline-item"]').first();

  // Get the text inside that outline item
  const outlineText = outlineItem.locator("p").first();

  // Get the color that that text is initially
  const initialColor = await outlineText.evaluate((el) => {
    return window.getComputedStyle(el).color;
  });

  // Hover over the outline
  await outlineItem.hover();

  // Get new color
  const newColor = await outlineText.evaluate((el) => {
    return window.getComputedStyle(el).color;
  });

  // Check to make sure that the color changed
  expect(newColor).not.toBe(initialColor);
});
/**
 * Hovering over outline item shows the outline carrot to open / close it
 */
test("Hovering over outline item shows the outline carrot to open / close it", async ({
  page,
}) => {
  // Get the outline item
  const outlineItem = page.locator('[data-testid="outline-item"]').first();

  // Hover over the outline item
  await outlineItem.hover();

  // Find the outline carrot
  const outlineCarrot = outlineItem
    .locator('[data-testid="outline-expander"]')
    .first();

  // Make sure its visible
  await expect(outlineCarrot).toBeVisible();
});

/**
 * Clicking on outline carrot opens the same topic
 */
test("Clicking on outline carrot opens the same topic", async ({ page }) => {
  // Get the outline item
  const outlineItem = page.locator('[data-testid="outline-item"]').first();

  // Hover over it
  await outlineItem.hover();

  // Get the outline carrot
  const outlineCarrot = outlineItem
    .locator('[data-testid="outline-expander"]')
    .first();

  // Click on the carrot
  await outlineCarrot.click();

  // Find the first topic, which should be the one the outline item points to
  const topic = page.locator('[data-testid="topic-item"]');

  // The 'expand' button should now say collapse topic, which means that its open
  const collapseButton = topic.getByRole("button", { name: "Collapse Topic" });

  // Existential check
  await expect(collapseButton).toHaveCount(1);
});

/**
 * Click on outline carrot does not trigger a scroll event
 */
test("Click on outline carrot does not trigger a scroll event", async ({
  page,
}) => {
  // Get the last outline item.
  const outlineItem = page.locator('[data-testid="outline-item"]').last();

  // Get the last topic
  const lastTopic = page.locator('[data-testid="topic-item"]').last();

  // Make sure the last topic is not in the viewport to start with
  // This also makes sure that the there's an overflow on the page's y axis.
  await expect(lastTopic).not.toBeInViewport();

  // Get the initial scroll position
  const initialScrollPosition = await page.evaluate(() => {
    return {
      x: window.scrollX,
      y: window.scrollY,
    };
  });

  // Hover over the outline item
  await outlineItem.hover();

  // Get the outline carrot
  const outlineCarrot = outlineItem
    .locator('[data-testid="outline-expander"]')
    .first();

  // Click on the outline carrot
  await outlineCarrot.click();

  // Compare the new scroll position
  const endScrollPosition = await page.evaluate(() => {
    return {
      x: window.scrollX,
      y: window.scrollY,
    };
  });

  // Since we don't want the outline carrot to cause a scroll event, we shouldn't see a change.
  await expect(lastTopic).not.toBeInViewport();
  expect(endScrollPosition.y).toBe(initialScrollPosition.y);
});
