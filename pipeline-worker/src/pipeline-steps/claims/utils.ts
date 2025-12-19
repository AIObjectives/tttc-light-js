/**
 * Utility functions for claims extraction pipeline step
 */

import type { Topic } from "./types.js";

// Re-export shared utilities
export { getReportLogger, tokenCost } from "../utils.js";

/**
 * Extract all valid topic names from taxonomy
 *
 * @param taxonomy - Array of topics
 * @returns Array of topic names
 */
export function extractTopicNames(taxonomy: Topic[]): string[] {
  return taxonomy.map((topic) => topic.topicName);
}

/**
 * Extract all valid subtopic names from taxonomy (across all topics)
 *
 * @param taxonomy - Array of topics
 * @returns Array of subtopic names
 */
export function extractSubtopicNames(taxonomy: Topic[]): string[] {
  const subtopicNames: string[] = [];
  for (const topic of taxonomy) {
    for (const subtopic of topic.subtopics || []) {
      subtopicNames.push(subtopic.subtopicName);
    }
  }
  return subtopicNames;
}
