/**
 * Utility functions for working with controversy/crux data
 */
import * as schema from "tttc-common/schema";

/**
 * Get controversy score for a topic (from topicScores)
 */
export function getTopicControversy(
  addOns: schema.AddOns | undefined,
  topicTitle: string,
): number | undefined {
  if (!addOns?.topicScores) return undefined;

  const topicScore = addOns.topicScores.find((ts) => ts.topic === topicTitle);
  return topicScore?.averageControversy;
}

/**
 * Get crux for a specific subtopic
 */
export function getSubtopicCrux(
  addOns: schema.AddOns | undefined,
  topicTitle: string,
  subtopicTitle: string,
): schema.SubtopicCrux | undefined {
  if (!addOns?.subtopicCruxes) return undefined;

  return addOns.subtopicCruxes.find(
    (crux) => crux.topic === topicTitle && crux.subtopic === subtopicTitle,
  );
}

/**
 * Format controversy score as X/10
 */
export function formatControversyScore(score: number): string {
  return `${(score * 10).toFixed(1)}/10`;
}

/**
 * Get color classes for controversy badge based on score
 * Returns { bg, text, border } with Tailwind classes
 *
 * NOTE: These classes are hardcoded to ensure Tailwind purge safety.
 * Do not dynamically construct these class names or they may be removed during build.
 */
export function getControversyColors(score: number): {
  bg: string;
  text: string;
  border: string;
} {
  // Score is 0-1, convert to 0-10 for easier thresholds
  const scoreOutOf10 = score * 10;

  // Determine controversy level
  const level = (() => {
    if (scoreOutOf10 >= 7.0) return "high";
    if (scoreOutOf10 >= 4.0) return "medium";
    return "low";
  })();

  switch (level) {
    case "high":
      // High controversy: red
      return {
        bg: "bg-red-100",
        text: "text-red-800",
        border: "border-red-300",
      };
    case "medium":
      // Medium controversy: orange
      return {
        bg: "bg-orange-100",
        text: "text-orange-800",
        border: "border-orange-300",
      };
    case "low":
    default:
      // Low controversy/consensus: green
      return {
        bg: "bg-green-100",
        text: "text-green-800",
        border: "border-green-300",
      };
  }
}

/**
 * Minimum controversy score (0-10 scale) required to display crux information
 * Scores below this threshold indicate general consensus and are not shown
 */
export const MIN_SIGNIFICANT_CONTROVERSY_SCORE = 3.0;

/**
 * Check if controversy score is significant enough to display
 * Returns true if score >= 3.0/10 (threshold for showing badge)
 */
export function isSignificantControversy(score: number): boolean {
  return score * 10 >= MIN_SIGNIFICANT_CONTROVERSY_SCORE;
}

/**
 * Get all cruxes sorted by controversy score (descending)
 */
export function getSortedCruxes(
  addOns: schema.AddOns | undefined,
): schema.SubtopicCrux[] {
  if (!addOns?.subtopicCruxes) return [];

  return [...addOns.subtopicCruxes].sort(
    (a, b) => b.controversyScore - a.controversyScore,
  );
}

/**
 * Parse speaker string (format: "id:name | strength") into components
 * Validates format and returns safe defaults for malformed input
 */
export function parseSpeaker(speakerStr: string): {
  id: string;
  name: string;
  strength?: number;
} {
  // Format is either "id:name" or "id:name | strength"
  const parts = speakerStr.split(" | ");
  const idNamePart = parts[0] || "";
  const strengthStr = parts[1];

  const idNameSplit = idNamePart.split(":");
  const id = idNameSplit[0] || "";
  const name = idNameSplit.slice(1).join(":") || "Unknown"; // Handle names with colons

  // Validate strength if provided
  const strength = strengthStr ? parseFloat(strengthStr) : undefined;
  const validStrength =
    strength !== undefined && !isNaN(strength) ? strength : undefined;

  return {
    id,
    name,
    strength: validStrength,
  };
}

/**
 * Find subtopic ID by topic and subtopic title
 * Used for navigation from crux cards to subtopics
 */
export function findSubtopicId(
  topics: schema.Topic[],
  topicTitle: string,
  subtopicTitle: string,
): string | null {
  for (const topic of topics) {
    if (topic.title === topicTitle) {
      const subtopic = topic.subtopics.find((st) => st.title === subtopicTitle);
      if (subtopic) return subtopic.id;
    }
  }
  return null;
}
