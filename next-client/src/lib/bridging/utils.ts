/**
 * Utility functions for bridging-based report structuring.
 *
 * Provides functions to sort quotes by bridging scores from
 * Perspective API analysis.
 */

import type { AddOns, Quote } from "tttc-common/schema";

/**
 * Bridging score thresholds for classification and visualization.
 *
 * These thresholds determine how claims are categorized based on their
 * bridging scores from the Perspective API.
 *
 * Score range is 0 to 3.0: (personalStory + reasoning + curiosity) * (1 - toxicity)
 */
export const BRIDGING_THRESHOLDS = {
  /** High bridging potential - constructive, bridge-building content */
  HIGH_BRIDGING: 1.5,
  /** Moderate bridging - somewhat constructive */
  MODERATE_BRIDGING: 0.75,
  /** Low bridging - minimal constructive qualities */
  LOW_BRIDGING: 0.25,
  /** Minimum score to show badge (scores below this are hidden unless forceShow) */
  MIN_DISPLAY: 1.0,
} as const;

/**
 * Sort quotes by bridging score (descending - highest bridging first).
 *
 * Quotes without bridging scores default to -1, placing them at the bottom
 * when sorted. This treats unscored content as "less bridging" than scored content.
 *
 * @param quotes - Array of quotes to sort
 * @param addOns - The addOns object containing bridging scores
 * @returns Sorted array of quotes (highest bridging score first)
 */
export const sortQuotesByBridging = (
  quotes: Quote[],
  addOns: AddOns | undefined,
): Quote[] => {
  if (!addOns?.quoteBridgingScores) return quotes;

  // Build lookup map once: O(n) instead of O(n²) with repeated find() calls
  const scoreMap = new Map(
    addOns.quoteBridgingScores.map((s) => [s.quoteId, s.bridgingScore]),
  );

  return [...quotes].sort((a, b) => {
    const scoreA = scoreMap.get(a.id) ?? -1;
    const scoreB = scoreMap.get(b.id) ?? -1;
    return scoreB - scoreA; // Descending order (highest bridging first)
  });
};

/**
 * Cache for claim bridging score lookup maps.
 * Uses WeakMap so maps are garbage collected when addOns objects are no longer referenced.
 */
const claimScoreMapCache = new WeakMap<
  NonNullable<AddOns["claimBridgingScores"]>,
  Map<string, number>
>();

/**
 * Get or create a lookup map for claim bridging scores.
 * Caches the map per claimBridgingScores array for O(1) repeated lookups.
 */
const getClaimScoreMap = (
  scores: NonNullable<AddOns["claimBridgingScores"]>,
): Map<string, number> => {
  let map = claimScoreMapCache.get(scores);
  if (!map) {
    map = new Map(scores.map((s) => [s.claimId, s.bridgingScore]));
    claimScoreMapCache.set(scores, map);
  }
  return map;
};

/**
 * Get the bridging score for a specific claim.
 *
 * Uses cached Map for O(1) lookups instead of O(n) find() calls.
 * This is important when rendering many claims in a report.
 *
 * @param claimId - The ID of the claim to look up
 * @param addOns - The addOns object containing bridging scores
 * @returns The bridging score for the claim, or undefined if not found
 */
export const getClaimBridgingScore = (
  claimId: string,
  addOns: AddOns | undefined,
): number | undefined => {
  if (!addOns?.claimBridgingScores) return undefined;
  const scoreMap = getClaimScoreMap(addOns.claimBridgingScores);
  return scoreMap.get(claimId);
};
