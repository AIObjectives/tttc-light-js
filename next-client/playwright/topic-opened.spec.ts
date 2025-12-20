import { test as base, expect, type Locator } from "@playwright/test";
import {
  defaultAddTopicPagination,
  defaultTopicPagination,
} from "@/components/report/hooks/useReportState/consts";

const baseUrl = new URL("http://localhost:3000");

const reportBaseUrl = new URL("/report/", baseUrl);

const testReportUrl = new URL(
  "https%3A%2F%2Fstorage.googleapis.com%2Ftttc-light-dev%2Ftest%2520longer%2520report-1740686953925.json",
  reportBaseUrl,
);

const test = base.extend<{ topic: Locator }>({
  topic: async ({ page }, use) => {
    await page.goto(testReportUrl.toString());

    await page.waitForLoadState("networkidle");
    const firstTopic = page.locator('[data-testid="topic-item"]').first();
    await firstTopic.getByRole("button", { name: "Expand Topic" }).click();
    use(firstTopic);
  },
});

/**
 * Hovering over the point graphic shows a hover card
 */
test("Hovering over the point graphic shows a hover card", async ({
  topic,
}) => {
  // Make sure the quote card isn't visible to start with.
  expect(await topic.locator('[data-testid="quotecard"]').isVisible()).toBe(
    false,
  );
  // Hover over the point graphic
  await topic.locator('[data-testid="point-graphic-cell"]').first().hover();

  // Check if hover card is visible
  const hoverCard = topic.locator('[data-testid="quotecard"]');
  await expect(hoverCard).toBeVisible();

  // Check for content
  expect(await hoverCard.textContent()).toBeTruthy();
});

/**
 * After opening the topic, the button says Collapse Topic
 */
test("After opening the topic, the button says Collapse Topic", async ({
  topic,
}) => {
  await expect(
    topic.getByRole("button", { name: "Collapse Topic" }),
  ).toBeVisible();
  await expect(
    topic.getByRole("button", { name: "Expand Topic" }),
  ).not.toBeVisible();
});

/**
 * Pressing show more subtopics shows the correct number of subtopics
 */
test("Pressing show more subtopics shows the correct number of subtopics", async ({
  topic,
}) => {
  // DefaultTopicPagination is index at 0, so add 1
  const expctedSubtopicsCount = defaultTopicPagination + 1;
  // we want the number of subtopics shown to be our default pagination
  expect(await topic.locator('[data-testid="subtopic-item"]').count()).toBe(
    expctedSubtopicsCount,
  );
  // Get the show more subtopics button
  const subtopicsButton = topic.locator(
    '[data-testid="show-more-subtopics-button"]',
  );
  // Click on the button
  await subtopicsButton.click();
  // We want the number of subtopics shown to increase
  expect(await topic.locator('[data-testid="subtopic-item"]').count()).toBe(
    expctedSubtopicsCount + defaultAddTopicPagination,
  );
});

/**
 * Pressing show more claims will eventually run out of subtopics
 */
test("Pressing show more claims will eventually run out of subtopics", async ({
  topic,
}) => {
  // Get the show more subtopics button
  const subtopicsButton = topic.locator(
    '[data-testid="show-more-subtopics-button"]',
  );
  // We want to make sure that if we keep clicking it, it'll eventually go away when there are no more subtopics to show
  // We'll also test to make sure that we don't end up with '0 more subtopics' or '-n more subtopics'
  //
  // Iterations
  let i: number;
  // Max iterations
  const maxIters = 10;
  for (i = 0; i < maxIters; i++) {
    if (await subtopicsButton.isVisible()) {
      // Get the text inside the button
      const text = await subtopicsButton.innerText();
      // Make sure it doesn't show 0 or -n
      expect(text).not.toContain("-");
      expect(text.slice(0, 1)).not.toBe("0");
      // Click again
      await subtopicsButton.click();
    } else {
      break;
    }
  }
  expect(i).toBeLessThan(maxIters);
});
