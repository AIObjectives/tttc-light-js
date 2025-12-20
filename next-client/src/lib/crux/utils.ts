/**
 * Utility functions for working with controversy/crux data
 *
 * ## Controversy Score Calculation
 *
 * Controversy scores (0-1) measure how evenly split opinions are on a topic.
 * The score is calculated server-side using the formula:
 *
 * ```
 * controversyScore = min(agreementScore, disagreementScore) * 2
 * ```
 *
 * Where:
 * - agreementScore = ratio of speakers who agree / total speakers
 * - disagreementScore = ratio of speakers who disagree / total speakers
 *
 * Examples:
 * - **Unanimous** (100% agree): min(1.0, 0.0) * 2 = 0.0 (no controversy)
 * - **Perfect split** (50/50): min(0.5, 0.5) * 2 = 1.0 (maximum controversy)
 * - **Mostly agree** (67/33): min(0.67, 0.33) * 2 = 0.66 (moderate controversy)
 *
 * This formula ensures scores are highest when opinions are evenly divided
 * and lowest when there's strong consensus in either direction.
 */

import { logger } from "tttc-common/logger/browser";
import type * as schema from "tttc-common/schema";
import type { ControversyCategory } from "./types";

// Create logger for speaker parsing
const speakerLogger = logger.child({ module: "speaker-parsing" });

/**
 * Controversy percentage thresholds (0-100 scale)
 *
 * NOTE: The function `getControversyCategory` accepts scores in 0-1 range and
 * converts them to percentages internally (score * 100) before comparing.
 *
 * These thresholds create 3 buckets matching our icon system:
 *
 * - HIGH (50-100%): Significant disagreement - participants are clearly divided
 * - MODERATE (20-49%): Some disagreement - mixed opinions among engaged participants
 * - LOW (0-19%): General consensus - most participants agree or few took a stance
 *
 * The formula (2 * min(agree, disagree) / total) dilutes controversy when many
 * speakers have "no_clear_position". These lower thresholds ensure that evenly
 * split opinions (e.g., 5 agree / 5 disagree / 20 no_clear = 25%) are categorized
 * as MODERATE rather than LOW.
 *
 * A score of 50%+ indicates the minority position holds at least 25% of total speakers.
 * A score of 20%+ indicates meaningful disagreement exists (minority >= 10% of total).
 */
const CONTROVERSY_PERCENT_HIGH = 50;
const CONTROVERSY_PERCENT_MODERATE = 20;

/**
 * Get controversy category based on score (0-1 range)
 * Maps to 3 tiers matching the icon system
 *
 * @throws {Error} If score is outside the valid 0-1 range
 */
export function getControversyCategory(score: number): ControversyCategory {
  // Validate score is in valid range
  if (score < 0 || score > 1 || !Number.isFinite(score)) {
    throw new Error(`Controversy score must be between 0 and 1, got: ${score}`);
  }

  // Convert to percentage for easier thresholds
  const percentage = score * 100;

  if (percentage >= CONTROVERSY_PERCENT_HIGH) {
    return {
      level: "high",
      label: "High",
      description: "Significant disagreement among participants",
    };
  }
  if (percentage >= CONTROVERSY_PERCENT_MODERATE) {
    return {
      level: "moderate",
      label: "Moderate",
      description: "Some disagreement among participants",
    };
  }
  return {
    level: "low",
    label: "Low",
    description: "General consensus among participants",
  };
}

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
  const category = getControversyCategory(score);

  switch (category.level) {
    case "high":
      // High controversy: orange
      return {
        bg: "bg-orange-100",
        text: "text-orange-800",
        border: "border-orange-300",
      };
    case "moderate":
      // Moderate controversy: yellow
      return {
        bg: "bg-yellow-100",
        text: "text-yellow-800",
        border: "border-yellow-300",
      };
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
 * Validate if a speaker ID is valid (non-empty, non-whitespace)
 * Centralized validation logic for consistency across all speaker handling
 *
 * @param id - Speaker ID to validate
 * @returns true if ID is valid (non-empty, non-whitespace)
 *
 * @example
 * isValidSpeakerId("123") // true
 * isValidSpeakerId("") // false
 * isValidSpeakerId("  ") // false
 */
export function isValidSpeakerId(id: string | null | undefined): boolean {
  return Boolean(id && id.trim() !== "");
}

/**
 * Validate if a speaker object has a valid ID
 * Works with both string speaker formats and Speaker objects
 *
 * @param speaker - Speaker object to validate
 * @returns true if speaker has a valid (non-empty, non-whitespace) ID
 *
 * @example
 * isValidSpeaker({ id: "123", name: "Alice" }) // true
 * isValidSpeaker({ id: "", name: "Alice" }) // false
 * isValidSpeaker({ id: "  ", name: "Alice" }) // false
 */
export function isValidSpeaker(speaker: { id: string; name: string }): boolean {
  return isValidSpeakerId(speaker.id);
}

/**
 * Filter out invalid speaker strings (empty or whitespace-only)
 * Centralized to ensure consistent validation across all speaker handling
 *
 * @param speakers - Array of speaker strings to filter
 * @returns Array with only valid (non-empty, non-whitespace) speakers
 *
 * @example
 * filterValidSpeakers(["1:Alice", "", "2:Bob", "  "]) // ["1:Alice", "2:Bob"]
 */
export function filterValidSpeakers(speakers: string[]): string[] {
  return speakers.filter((s) => isValidSpeakerId(s));
}

/**
 * Parse speaker string into components. Returns safe defaults for malformed input.
 *
 * @example
 * parseSpeaker("42:John Doe") // { id: "42", name: "John Doe" }
 * parseSpeaker("42:John Doe | 0.8") // { id: "42", name: "John Doe", strength: 0.8 }
 * parseSpeaker("invalid") // { id: "", name: "Unknown Speaker" }
 */
export function parseSpeaker(speakerStr: string): {
  id: string;
  name: string;
  strength?: number;
} {
  // Validate input
  if (!speakerStr || typeof speakerStr !== "string") {
    if (process.env.NODE_ENV === "development") {
      speakerLogger.warn(
        {
          speakerStr,
          speakerType: typeof speakerStr,
          validationRule: "non-empty string required",
        },
        "Invalid speaker string: empty or non-string",
      );
    }
    return { id: "", name: "Unknown Speaker" };
  }

  // Format is either "id:name" or "id:name | strength"
  const parts = speakerStr.split(" | ");
  const idNamePart = parts[0]?.trim() || "";
  const strengthStr = parts[1]?.trim();

  // Parse id:name format
  const colonIndex = idNamePart.indexOf(":");
  if (colonIndex === -1) {
    // Missing colon separator - treat entire string as ID with unknown name
    if (process.env.NODE_ENV === "development") {
      speakerLogger.warn(
        {
          speakerStr,
          idNamePart,
          validationRule: "id:name format required",
          parseError: "missing colon separator",
        },
        "Malformed speaker string: missing colon separator",
      );
    }
    return {
      id: idNamePart || "",
      name: "Unknown Speaker",
    };
  }

  const id = idNamePart.substring(0, colonIndex).trim();
  const name = idNamePart.substring(colonIndex + 1).trim() || "Unknown Speaker";

  // Validate and parse strength if provided
  let validStrength: number | undefined;
  if (strengthStr) {
    const strength = parseFloat(strengthStr);
    if (!Number.isNaN(strength) && Number.isFinite(strength)) {
      validStrength = strength;
    }
  }

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
