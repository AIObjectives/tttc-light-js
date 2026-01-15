import { test as base, expect, type Locator } from "@playwright/test";
import {
  defaultAddSubtopicPagination,
  defaultSubtopicPagination,
} from "@/stores/consts";

const baseUrl = new URL("http://localhost:3000");

const reportBaseUrl = new URL("/report/", baseUrl);

const testReportUrl = new URL(
  "https%3A%2F%2Fstorage.googleapis.com%2Ftttc-light-dev%2Ftest%2520longer%2520report-1740686953925.json",
  reportBaseUrl,
);

const test = base.extend<{ subtopic: Locator }>({
  subtopic: async ({ page }, use) => {
    await page.goto(testReportUrl.toString());

    await page.waitForLoadState("networkidle");
    const firstTopic = page.locator('[data-testid="topic-item"]').first();
    await firstTopic.getByRole("button", { name: "Expand Topic" }).click();

    const subtopic = firstTopic
      .locator('[data-testid="subtopic-item"]')
      .first();

    use(subtopic);
  },
});

/**
 * Pressing copies url for subtopic
 */
test("Pressing copies url for subtopic", async ({
  subtopic,
  browserName,
  page,
}) => {
  // This test should only run on Chromium
  test.skip(
    browserName !== "chromium",
    "Skipping... Clipboard only works in Chromium",
  );

  const expectedLink =
    "http://localhost:3000/report/https%3A%2F%2Fstorage.googleapis.com%2Ftttc-light-dev%2Ftest%2520longer%2520report-1740686953925.json#AGI%20Development";

  // Get the copy button
  const copyButton = subtopic.locator('[data-testid="copybutton"]').first();

  // Click on the copy button
  await copyButton.click();

  // The link should now be copied to the clipboard. get it
  const clipboardContent = await page
    .evaluateHandle(() => navigator.clipboard.readText())
    .then((val) => val.jsonValue());

  // We should expect the links to match
  expect(clipboardContent).toBe(expectedLink);
});

/**
 * Pressing show more claims shows the correct number of additional claims
 */
test("Pressing show more claims shows the correct number of additional claims", async ({
  subtopic,
}) => {
  // DefaultSubtopicPagination is indexed at 0, so add 1
  const expectedClaimsCount = defaultSubtopicPagination + 1;
  // Get the claims in this subtopic that are visible
  // As of right now, all claims are rendered, but are invisible unless they are within the pagination.
  // Hence the :visible selector
  expect(
    await subtopic.locator('[data-testid="claim-item"]:visible').count(),
  ).toBe(expectedClaimsCount);

  // Get the show more claims button
  const claimsButton = subtopic.locator(
    '[data-testid="show-more-claims-button"]',
  );

  // Click it
  await claimsButton.click();

  // We should now see more claims
  expect(
    await subtopic.locator('[data-testid="claim-item"]:visible').count(),
  ).toBe(expectedClaimsCount + defaultAddSubtopicPagination);
});

/**
 * Pressing show more claims will eventually run out of claims
 */
test("Pressing show more claims will eventually run out of claims", async ({
  subtopic,
}) => {
  // Get the show more claims button
  const claimsButton = subtopic.locator(
    '[data-testid="show-more-claims-button"]',
  );
  // We want to make sure that if we keep clicking it, it'll eventually go away when there are no more claims to show
  // We'll also test to make sure that we don't end up with '0 more claims' or '-n more claims'
  //
  // Iterations
  let i: number;
  // Max iters
  const maxIters = 10;
  for (i = 0; i < maxIters; i++) {
    if (await claimsButton.isVisible()) {
      // Get the text's button
      const text = await claimsButton.innerText();
      // Make sure that it's not 0 or -n more claims
      expect(text).not.toContain("-");
      expect(text.slice(0, 1)).not.toBe("0");
      // Click it again
      await claimsButton.click();
    } else {
      break;
    }
  }
  expect(i).toBeLessThan(maxIters);
});
