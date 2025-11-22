/**
 * Utility functions for bridging-based report structuring.
 *
 * Provides functions to retrieve, format, and visualize bridging scores from
 * Perspective API analysis.
 */

import type {
  AddOns,
  ClaimBridgingScore,
  QuoteBridgingScore,
  Quote,
} from "tttc-common/schema";

/**
 * Bridging score thresholds for classification and visualization.
 *
 * These thresholds determine how claims are categorized based on their
 * bridging scores from the Perspective API.
 */
export const BRIDGING_THRESHOLDS = {
  /** High bridging potential - constructive, bridge-building content */
  HIGH_BRIDGING: 0.5,
  /** Moderate bridging - somewhat constructive */
  MODERATE_BRIDGING: 0.25,
  /** Neutral - neither bridging nor divisive */
  NEUTRAL: 0.0,
  /** Somewhat divisive - mildly divisive */
  SOMEWHAT_DIVISIVE: -0.25,
  /** Minimum score to show badge (scores below this are hidden unless forceShow) */
  MIN_DISPLAY: 0.3,
} as const;

/**
 * Get the bridging score for a specific claim.
 *
 * @param addOns - The addOns object from the report
 * @param claimId - The ID of the claim to get the score for
 * @returns The bridging score (0-1 range), or null if not found
 */
export const getBridgingScore = (
  addOns: AddOns | undefined,
  claimId: string,
): number | null => {
  if (!addOns?.claimBridgingScores) return null;

  const scoreEntry = addOns.claimBridgingScores.find(
    (score) => score.claimId === claimId,
  );

  return scoreEntry?.bridgingScore ?? null;
};

/**
 * Get all bridging score details for a specific claim.
 *
 * @param addOns - The addOns object from the report
 * @param claimId - The ID of the claim
 * @returns The complete ClaimBridgingScore object, or null if not found
 */
export const getBridgingScoreDetails = (
  addOns: AddOns | undefined,
  claimId: string,
): ClaimBridgingScore | null => {
  if (!addOns?.claimBridgingScores) return null;

  return (
    addOns.claimBridgingScores.find((score) => score.claimId === claimId) ||
    null
  );
};

/**
 * Format a bridging score for display (0-100 scale).
 *
 * @param score - Raw bridging score (-0.5 to 1.0)
 * @returns Formatted score string (e.g., "72.5")
 */
export const formatBridgingScore = (score: number): string => {
  // Normalize from [-0.5, 1.0] to [0, 100]
  // score = -0.5 => 0
  // score = 0.25 => 50
  // score = 1.0 => 100
  const normalized = ((score + 0.5) / 1.5) * 100;
  return Math.max(0, Math.min(100, normalized)).toFixed(1);
};

/**
 * Get Tailwind color class based on bridging score.
 *
 * High scores (green) = constructive, bridge-building content
 * Medium scores (yellow) = neutral
 * Low scores (red) = divisive or toxic content
 *
 * @param score - Bridging score (-0.5 to 1.0)
 * @returns Tailwind color class string
 */
export const getBridgingColor = (score: number): string => {
  if (score >= BRIDGING_THRESHOLDS.HIGH_BRIDGING) return "text-green-600"; // High bridging potential
  if (score >= BRIDGING_THRESHOLDS.NEUTRAL) return "text-yellow-600"; // Moderate
  return "text-red-600"; // Low/divisive
};

/**
 * Get background color class for bridging score badges.
 *
 * @param score - Bridging score (-0.5 to 1.0)
 * @returns Tailwind background color class string
 */
export const getBridgingBgColor = (score: number): string => {
  if (score >= BRIDGING_THRESHOLDS.HIGH_BRIDGING)
    return "bg-green-100 border-green-300";
  if (score >= BRIDGING_THRESHOLDS.NEUTRAL)
    return "bg-yellow-100 border-yellow-300";
  return "bg-red-100 border-red-300";
};

/**
 * Get a human-readable label for a bridging score.
 *
 * @param score - Bridging score (-0.5 to 1.0)
 * @returns Label string
 */
export const getBridgingLabel = (score: number): string => {
  if (score >= BRIDGING_THRESHOLDS.HIGH_BRIDGING)
    return "High bridging potential";
  if (score >= BRIDGING_THRESHOLDS.MODERATE_BRIDGING)
    return "Moderate bridging";
  if (score >= BRIDGING_THRESHOLDS.NEUTRAL) return "Neutral";
  if (score >= BRIDGING_THRESHOLDS.SOMEWHAT_DIVISIVE)
    return "Somewhat divisive";
  return "Low bridging potential";
};

/**
 * Sort claims by bridging score (descending).
 *
 * @param claims - Array of claims to sort
 * @param addOns - The addOns object containing bridging scores
 * @returns Sorted array of claims (highest bridging score first)
 */
export const sortClaimsByBridging = <T extends { id: string }>(
  claims: T[],
  addOns: AddOns | undefined,
): T[] => {
  if (!addOns?.claimBridgingScores) return claims;

  return [...claims].sort((a, b) => {
    const scoreA = getBridgingScore(addOns, a.id) ?? -1;
    const scoreB = getBridgingScore(addOns, b.id) ?? -1;
    return scoreB - scoreA; // Descending order
  });
};

/**
 * Check if bridging scores are available in the report.
 *
 * @param addOns - The addOns object from the report
 * @returns True if bridging scores are available
 */
export const hasBridgingScores = (addOns: AddOns | undefined): boolean => {
  return !!addOns?.claimBridgingScores && addOns.claimBridgingScores.length > 0;
};

/**
 * Get summary statistics for bridging scores in the report.
 *
 * @param addOns - The addOns object from the report
 * @returns Summary statistics object
 */
export const getBridgingStatistics = (
  addOns: AddOns | undefined,
): {
  count: number;
  average: number;
  highest: number;
  lowest: number;
} | null => {
  if (!addOns?.claimBridgingScores || addOns.claimBridgingScores.length === 0)
    return null;

  const scores = addOns.claimBridgingScores.map((s) => s.bridgingScore);

  return {
    count: scores.length,
    average: scores.reduce((a, b) => a + b, 0) / scores.length,
    highest: Math.max(...scores),
    lowest: Math.min(...scores),
  };
};

/**
 * Get the bridging score for a specific quote.
 *
 * @param addOns - The addOns object from the report
 * @param quoteId - The ID of the quote to get the score for
 * @returns The bridging score, or null if not found
 */
export const getQuoteBridgingScore = (
  addOns: AddOns | undefined,
  quoteId: string,
): number | null => {
  if (!addOns?.quoteBridgingScores) return null;

  const scoreEntry = addOns.quoteBridgingScores.find(
    (score) => score.quoteId === quoteId,
  );

  return scoreEntry?.bridgingScore ?? null;
};

/**
 * Get all bridging score details for a specific quote.
 *
 * @param addOns - The addOns object from the report
 * @param quoteId - The ID of the quote
 * @returns The complete QuoteBridgingScore object, or null if not found
 */
export const getQuoteBridgingScoreDetails = (
  addOns: AddOns | undefined,
  quoteId: string,
): QuoteBridgingScore | null => {
  if (!addOns?.quoteBridgingScores) return null;

  return (
    addOns.quoteBridgingScores.find((score) => score.quoteId === quoteId) ||
    null
  );
};

/**
 * Check if quote bridging scores are available in the report.
 *
 * @param addOns - The addOns object from the report
 * @returns True if quote bridging scores are available
 */
export const hasQuoteBridgingScores = (addOns: AddOns | undefined): boolean => {
  return !!addOns?.quoteBridgingScores && addOns.quoteBridgingScores.length > 0;
};

/**
 * Sort quotes by bridging score (descending - highest bridging first).
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
