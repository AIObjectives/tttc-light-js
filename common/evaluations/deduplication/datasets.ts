/**
 * Test cases for deduplication evaluation
 *
 * Each test case contains a set of claims that should be deduplicated and grouped by the model.
 * The claims are provided as a formatted string with the following structure:
 * - ID: Unique identifier for the claim
 * - Claim: The text content of the claim
 * - Quote: Supporting quote or context for the claim
 *
 * Claims are separated by blank lines (double newlines).
 *
 * @example
 * ```
 * ID: claim1
 * Claim: Parking fees are too expensive
 * Quote: I can't afford to pay $20 a day
 *
 * ID: claim2
 * Claim: Downtown parking costs are prohibitive
 * Quote: Parking fees are ridiculously high
 * ```
 */
export const deduplicationTestCases = [
  /**
   * Test case with multiple related parking claims
   * Tests the model's ability to group similar claims about parking issues
   * while keeping distinct aspects (cost, navigation, capacity) separate if appropriate
   */
  {
    id: "dedup-1",
    claims: `ID: "claim1",
Claim: "Parking fees are too expensive for downtown workers",
Quote: "I can't afford to pay $20 a day for parking",


ID: "claim2",
Claim: "The parking pass system is confusing and hard to navigate",
Quote: "I spent an hour trying to figure out how to buy a monthly pass",


ID: "claim3",
Claim: "We need more parking spaces in the downtown area",
Quote: "I drive around for 30 minutes every morning looking for a spot",`,
  },
  /**
   * Test case with unrelated claims from different topics
   * Tests the model's ability to keep distinct claims separate
   * (renewable energy vs. plastic bag ban)
   */
  {
    id: "dedup-2",
    claims: `ID: "claim1",
Claim: "We should prioritize renewable energy investments",
Quote: "Solar and wind power are the future",


ID: "claim2",
Claim: "The city should ban single-use plastic bags",
Quote: "Plastic bags are harming our environment",`,
  },
  /**
   * Test case with library-related claims
   * Tests the model's ability to group similar claims about library hours
   * (claim1 and claim2 are similar) while keeping distinct staffing concerns separate (claim3)
   */
  {
    id: "dedup-3",
    claims: `ID: "claim1",
Claim: "The library should have longer hours on weekends",
Quote: "I work weekdays and can only visit on Saturday",


ID: "claim2",
Claim: "Library hours should be extended in the evening"
Quote: "The library closes too early for working parents"


ID: "claim3",
Claim: "We need more library staff to help with research"
Quote:"There's never anyone available when I need help finding books"`,
  },
];
