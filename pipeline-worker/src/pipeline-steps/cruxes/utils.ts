/**
 * Utility functions for cruxes extraction
 */

import type {
  ClaimsTree,
  SpeakerCruxMatrix,
  SpeakerMap,
  SubtopicCrux,
  Topic,
  TopicDescMap,
  TopicScore,
} from "./types";

/**
 * Speaker ID format separator
 * Format: "speakerId:speakerName"
 */
export const SPEAKER_FORMAT_SEPARATOR = ":";

/**
 * Format speaker IDs to "id:name" format for output
 *
 * @param speakerIds - Array of speaker IDs
 * @param idsToSpeakers - Map of speaker IDs to speaker names
 * @returns Array of formatted speaker strings in "id:name" format
 */
export function formatSpeakersForOutput(
  speakerIds: string[],
  idsToSpeakers: Record<string, string>,
): string[] {
  return speakerIds.map(
    (speakerId) =>
      `${speakerId}${SPEAKER_FORMAT_SEPARATOR}${idsToSpeakers[speakerId]}`,
  );
}

/**
 * Build a map of topic/subtopic names to their descriptions
 *
 * @param topics - Array of topics with descriptions
 * @returns Map of topic/subtopic names to descriptions
 */
export function buildTopicDescMap(topics: Topic[]): TopicDescMap {
  const descMap: TopicDescMap = {};

  for (const topic of topics) {
    descMap[topic.topicName] = topic.topicShortDescription;

    if (topic.subtopics) {
      for (const subtopic of topic.subtopics) {
        descMap[subtopic.subtopicName] = subtopic.subtopicShortDescription;
      }
    }
  }

  return descMap;
}

/**
 * Build a full speaker map from the claims tree
 * Collects all distinct speakers, sorts alphabetically, and assigns numeric IDs
 *
 * @param claimsTree - The claims tree structure
 * @returns Map of speaker names to numeric IDs
 */
export function buildFullSpeakerMap(claimsTree: ClaimsTree): SpeakerMap {
  const speakers = new Set<string>();

  for (const topicName in claimsTree) {
    const topicNode = claimsTree[topicName];
    for (const subtopicName in topicNode.subtopics) {
      const subtopicNode = topicNode.subtopics[subtopicName];
      for (const claim of subtopicNode.claims) {
        speakers.add(claim.speaker);
      }
    }
  }

  // Sort alphabetically for deterministic ordering
  const speakerList = Array.from(speakers).sort();

  // Map to numeric IDs
  const speakerMap: SpeakerMap = {};
  for (let i = 0; i < speakerList.length; i++) {
    speakerMap[speakerList[i]] = String(i);
  }

  return speakerMap;
}

/**
 * Calculate controversy scores for a single crux
 *
 * Edge cases:
 * - If totalSpeakers is 0, returns all scores as 0
 * - If all speakers agree (no disagreement), controversyScore will be 0
 * - If all speakers disagree (no agreement), controversyScore will be 0
 * - If LLM returns empty agree/disagree arrays, both scores will be 0
 *
 * @param agreeSpeakers - Array of speakers who agree
 * @param disagreeSpeakers - Array of speakers who disagree
 * @param totalSpeakers - Total number of speakers in the subtopic
 * @returns Object with agreementScore, disagreementScore, and controversyScore
 */
export function calculateControversyScores(
  agreeSpeakers: string[],
  disagreeSpeakers: string[],
  totalSpeakers: number,
): {
  agreementScore: number;
  disagreementScore: number;
  controversyScore: number;
} {
  const numAgree = agreeSpeakers.length;
  const numDisagree = disagreeSpeakers.length;

  const agreementScore = totalSpeakers > 0 ? numAgree / totalSpeakers : 0;
  const disagreementScore = totalSpeakers > 0 ? numDisagree / totalSpeakers : 0;

  // Controversy is highest when opinions are evenly split
  // min() gives us the smaller group, *2 normalizes to 0-1 range
  // Examples:
  // - 50/50 split: min(0.5, 0.5) * 2 = 1.0 (maximum controversy)
  // - 80/20 split: min(0.8, 0.2) * 2 = 0.4 (low controversy)
  // - All agree (100/0): min(1.0, 0.0) * 2 = 0.0 (no controversy)
  // - All disagree (0/100): min(0.0, 1.0) * 2 = 0.0 (no controversy)
  // - Empty arrays (0/0): min(0.0, 0.0) * 2 = 0.0 (no controversy)
  const controversyScore = Math.min(agreementScore, disagreementScore) * 2;

  return {
    agreementScore,
    disagreementScore,
    controversyScore,
  };
}

/**
 * Calculate average controversy score for a set of cruxes
 */
function calculateAverageControversy(cruxes: SubtopicCrux[]): number {
  const scores = cruxes.map((c) => c.controversyScore);
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

/**
 * Count unique speakers across all cruxes
 */
function countUniqueSpeakersInCruxes(cruxes: SubtopicCrux[]): number {
  const speakers = new Set<string>();
  for (const crux of cruxes) {
    for (const s of crux.agree) speakers.add(s);
    for (const s of crux.disagree) speakers.add(s);
  }
  return speakers.size;
}

/**
 * Calculate score for a single topic
 */
function calculateSingleTopicScore(
  topicName: string,
  cruxes: SubtopicCrux[],
): TopicScore {
  return {
    topic: topicName,
    averageControversy: calculateAverageControversy(cruxes),
    subtopicCount: cruxes.length,
    totalSpeakers: countUniqueSpeakersInCruxes(cruxes),
  };
}

/**
 * Calculate topic-level rollup scores
 *
 * @param subtopicCruxesByTopic - Map of topic names to arrays of subtopic cruxes
 * @returns Array of topic scores with averageControversy, subtopicCount, totalSpeakers
 */
export function calculateTopicScores(
  subtopicCruxesByTopic: Record<string, SubtopicCrux[]>,
): TopicScore[] {
  const topicScores: TopicScore[] = [];

  for (const topicName in subtopicCruxesByTopic) {
    const cruxes = subtopicCruxesByTopic[topicName];
    if (cruxes.length === 0) continue;

    topicScores.push(calculateSingleTopicScore(topicName, cruxes));
  }

  return topicScores;
}

/**
 * Build a Speaker × Crux agreement matrix for visualization
 *
 * @param subtopicCruxes - Array of subtopic crux objects
 * @param allSpeakers - Array of all speaker IDs in format "id:name"
 * @returns Matrix with speakers, cruxLabels, and matrix[speakerIdx][cruxIdx]
 */
export function buildSpeakerCruxMatrix(
  subtopicCruxes: SubtopicCrux[],
  allSpeakers: string[],
): SpeakerCruxMatrix {
  if (subtopicCruxes.length === 0 || allSpeakers.length === 0) {
    return {
      speakers: [],
      cruxLabels: [],
      matrix: [],
    };
  }

  // Build crux labels (e.g., "AI Safety → Regulation")
  const cruxLabels = subtopicCruxes.map(
    (crux) => `${crux.topic} → ${crux.subtopic}`,
  );

  // Initialize matrix with "no_position" for all
  const matrix: string[][] = [];
  for (let i = 0; i < allSpeakers.length; i++) {
    matrix.push(new Array(subtopicCruxes.length).fill("no_position"));
  }

  // Fill in positions based on agree/disagree/no_clear_position lists
  for (let cruxIdx = 0; cruxIdx < subtopicCruxes.length; cruxIdx++) {
    const crux = subtopicCruxes[cruxIdx];
    const agreeSet = new Set(crux.agree);
    const disagreeSet = new Set(crux.disagree);
    const noClearPositionSet = new Set(crux.no_clear_position);

    for (let speakerIdx = 0; speakerIdx < allSpeakers.length; speakerIdx++) {
      const speaker = allSpeakers[speakerIdx];
      if (agreeSet.has(speaker)) {
        matrix[speakerIdx][cruxIdx] = "agree";
      } else if (disagreeSet.has(speaker)) {
        matrix[speakerIdx][cruxIdx] = "disagree";
      } else if (noClearPositionSet.has(speaker)) {
        matrix[speakerIdx][cruxIdx] = "no_position";
      }
      // else remains "no_position" (speaker never mentioned this subtopic)
    }
  }

  return {
    speakers: allSpeakers,
    cruxLabels,
    matrix,
  };
}
