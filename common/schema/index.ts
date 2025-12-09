// import { getNClaims } from "./morphisms";
import { z } from "zod";
import { logger as browserLogger } from "../logger/browser";

/** VVVVVVVVVVVVVVVVVVVVVVVVVVVVV */
/********************************
 * CSV TYPES
 ********************************/
/** ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ */

/**
 * Source Row
 * What the parsed CSV files should look like
 */
export const sourceRow = z.object({
  comment: z.string(),
  id: z.string(),
  interview: z.string().optional(),
  video: z.string().optional(),
  timestamp: z.string().optional(),
});

const csvDataPayload = z.tuple([z.literal("csv"), sourceRow.array()]);

/**
 * Google Sheet Data
 * What input from a google sheet should look like
 */
const googleSheetData = z.object({
  url: z.string(),
  pieChartColumns: z.string().array().optional(),
  filterEmails: z.string().array().optional(),
  oneSubmissionPerEmail: z.boolean(),
});

export type GoogleSheetData = z.infer<typeof googleSheetData>;

const googleSheetDataPayload = z.tuple([
  z.literal("googlesheet"),
  googleSheetData,
]);

/**
 * Data Payload
 * Union of CSV and Google Sheet inputs
 */
export const dataPayload = z.union([csvDataPayload, googleSheetDataPayload]);

export type DataPayload = z.infer<typeof dataPayload>;

export type SourceRow = z.infer<typeof sourceRow>;

/** VVVVVVVVVVVVVVVVVVVVVVVVVVVVV */
/********************************
 * LLM TYPES
 ********************************/
/** ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ */

export const llmPieChart = z.object({
  title: z.string(),
  items: z.object({ label: z.string(), count: z.number() }).array(),
});

export type LLMPieChart = z.infer<typeof llmPieChart>;

export const llmUserConfig = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  systemInstructions: z.string().min(1),
  clusteringInstructions: z.string().min(1),
  extractionInstructions: z.string().min(1),
  dedupInstructions: z.string().min(1),
  summariesInstructions: z.string().min(1),
  cruxInstructions: z.string(),
  cruxesEnabled: z.boolean(),
  bridgingEnabled: z.boolean().default(false),
});

export type LLMUserConfig = z.infer<typeof llmUserConfig>;

export const llmSystemConfig = z.object({
  model: z.string().optional(),
  batchSize: z.number(),
  filename: z.string(),
});

export type oldSystemConfig = z.infer<typeof llmSystemConfig>;

export const oldOptions = z.object({
  model: z.string(),
  data: sourceRow.array(),
  title: z.string(),
  question: z.string(),
  pieCharts: llmPieChart.array().optional(),
  description: z.string(),
  systemInstructions: z.string(),
  clusteringInstructions: z.string(),
  extractionInstructions: z.string(),
  dedupInstructions: z.string(),
  summariesInstructions: z.string(),
  cruxInstructions: z.string(),
  cruxesEnabled: z.boolean(),
  batchSize: z.number(),
  filename: z.string(),
  googleSheet: z
    .object({
      url: z.string(),
      pieChartColumns: z.string().array().optional(),
      filterEmails: z.string().array().optional(),
      oneSubmissionPerEmail: z.boolean(),
    })
    .optional(),
});

export type OldOptions = z.infer<typeof oldOptions>;

// Zod has trouble with self-referential types, so leave this be until we need to parse
type _LLMClaim = {
  claim: string;
  quote: string;
  claimId?: string;
  topicName: string;
  subtopicName?: string;
  commentId?: string;
  duplicates?: LLMClaim[];
  duplicated?: boolean;
};

const oldclaim = z.custom<_LLMClaim>();

export type LLMClaim = z.infer<typeof oldclaim>;

export const cache = z.object({
  get: z.function().args(z.string()).returns(z.any()),
  set: z.function().args(z.string(), z.any()).returns(z.void()),
});

export type Cache = z.infer<typeof cache>;

export const tracker = z.object({
  start: z.number(),
  costs: z.number(),
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  total_tokens: z.number(),
  unmatchedClaims: z.array(oldclaim),
  end: z.number().optional(),
  duration: z.string().optional(),
});

export type Tracker = z.infer<typeof tracker>;

export const usageTokens = z.object({
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  total_tokens: z.number(),
});
export type UsageTokens = z.infer<typeof usageTokens>;

export const llmSubtopic = z.object({
  subtopicName: z.string(),
  subtopicShortDescription: z.string().optional(),
  subtopicId: z.string().optional(),
  claimsCount: z.number().optional(),
  claims: z.array(oldclaim).optional(),
});

export type LLMSubtopic = z.infer<typeof llmSubtopic>;

export const llmTopic = z.object({
  topicName: z.string(),
  topicSummary: z.string().optional(),
  topicShortDescription: z.string().optional(),
  topicId: z.string().optional(),
  claimsCount: z.number().optional(),
  subtopics: z.array(llmSubtopic),
});

export type LLMTopic = z.infer<typeof llmTopic>;

export const taxonomy = z.array(llmTopic);

export type Taxonomy = z.infer<typeof taxonomy>;

/********************************
 * Add-ons: Optional Research Features
 *
 * Container for experimental/research features like cruxes analysis.
 * All fields are optional - only populated when features are enabled.
 ********************************/

/**
 * SubtopicCrux: A crux claim with controversy metrics for a single subtopic.
 *
 * Represents a synthesized controversial statement (not an original claim) that
 * divides participants on a specific subtopic. Includes simple metrics for sorting.
 *
 * Scoring:
 * - agreementScore: 0-1 (ratio of speakers who agree / total speakers)
 * - disagreementScore: 0-1 (ratio of speakers who disagree / total speakers)
 * - controversyScore: 0-1 (how evenly split the opinions are)
 *   - 1.0 = perfectly split 50/50
 *   - 0.0 = unanimous or no opinions
 *   - Formula: min(agreementScore, disagreementScore) * 2
 *
 * Example:
 * {
 *   topic: "Healthcare Reform",
 *   subtopic: "Universal Coverage",
 *   cruxClaim: "Government should guarantee healthcare for all citizens",
 *   agree: ["1:Alice", "3:Charlie"],
 *   disagree: ["2:Bob"],
 *   no_clear_position: ["4:Diana"],  // Diana mentioned healthcare but didn't take a clear stance
 *   explanation: "Alice and Charlie emphasize access while Bob questions feasibility...",
 *   agreementScore: 0.67,      // 2 out of 3 speakers agree
 *   disagreementScore: 0.33,   // 1 out of 3 speakers disagree
 *   controversyScore: 0.66     // min(0.67, 0.33) * 2 = reasonably controversial
 * }
 */

/**
 * Helper function to validate that speakers don't appear in multiple position lists
 * Extracted for better testability and reusability
 */
function validateNoSpeakerOverlap(data: {
  agree: string[];
  disagree: string[];
  no_clear_position: string[];
}): boolean {
  // Extract speaker IDs from "id:name" format
  const agreeIds = new Set(data.agree.map((s) => s.split(":")[0]));
  const disagreeIds = new Set(data.disagree.map((s) => s.split(":")[0]));
  const noClearIds = new Set(
    data.no_clear_position.map((s) => s.split(":")[0]),
  );

  // Check for overlaps between the three sets
  const agreeDisagreeOverlap = [...agreeIds].some((id) => disagreeIds.has(id));
  const agreeNoClearOverlap = [...agreeIds].some((id) => noClearIds.has(id));
  const disagreeNoClearOverlap = [...disagreeIds].some((id) =>
    noClearIds.has(id),
  );

  return (
    !agreeDisagreeOverlap && !agreeNoClearOverlap && !disagreeNoClearOverlap
  );
}

/**
 * Extract speaker ID from formatted speaker string.
 *
 * Expected format: "id:name" or "id:name | strength"
 * Returns empty string if format is invalid or ID is missing.
 *
 * This function is used internally by the deduplication algorithm to identify
 * unique speakers across agree/disagree/no_clear_position lists.
 *
 * @param speaker - Speaker string to parse
 * @returns Speaker ID (everything before first colon) or empty string if invalid
 *
 * @example
 * ```typescript
 * extractSpeakerId("123:Alice")           // "123"
 * extractSpeakerId("123:Alice | 0.8")     // "123"
 * extractSpeakerId("123:Name:With:Colons")// "123"
 * extractSpeakerId(":NoID")               // ""
 * extractSpeakerId("NoColon")             // ""
 * extractSpeakerId("")                    // ""
 * extractSpeakerId("  ")                  // ""
 * ```
 *
 * @validation
 * - null/undefined/non-string → ""
 * - empty string or whitespace only → ""
 * - no colon separator → "" (invalid format)
 * - empty ID before colon (":NoID") → ""
 * - whitespace around ID is trimmed
 *
 * @private Internal helper for deduplication logic
 */
function extractSpeakerId(speaker: string): string {
  // Validate input type and check for empty/whitespace
  if (!speaker || typeof speaker !== "string" || !speaker.trim()) {
    return "";
  }

  // Check for colon separator (required format)
  const colonIndex = speaker.indexOf(":");
  if (colonIndex === -1) {
    // No colon found - invalid format
    return "";
  }

  // Extract ID (everything before first colon)
  const id = speaker.substring(0, colonIndex).trim();

  // Validate ID is not empty after trimming
  return id || "";
}

/**
 * Speaker info tracked during reconciliation
 */
type SpeakerInfo = {
  fullString: string; // Full speaker string (id:name or id:name | strength)
  appearsIn: Set<"agree" | "disagree" | "no_clear">; // Which lists contain this speaker
  countByList: { agree: number; disagree: number; no_clear: number }; // Appearances per list
};

/**
 * Build a map of speaker IDs to their metadata across all position lists.
 * Preserves the richest speaker data when duplicates exist.
 */
function buildSpeakerMap(data: {
  agree: string[];
  disagree: string[];
  no_clear_position: string[];
}): { speakerMap: Map<string, SpeakerInfo>; inputCount: number } {
  const speakerMap = new Map<string, SpeakerInfo>();
  let inputCount = 0;

  const processList = (
    list: string[],
    listType: "agree" | "disagree" | "no_clear",
  ) => {
    for (const speaker of list) {
      const id = extractSpeakerId(speaker);
      if (!id) continue; // Skip invalid/empty speakers

      inputCount++;
      const existing = speakerMap.get(id);
      if (existing) {
        existing.appearsIn.add(listType);
        existing.countByList[listType]++;
        // Preserve the richest speaker data (prioritize metadata/strength score, then length)
        // Examples: "1:Alice | 0.9" is richer than "1:Alice", "1:Alice Smith" is richer than "1:Alice"
        if (
          (speaker.includes("|") && !existing.fullString.includes("|")) ||
          (speaker.includes("|") === existing.fullString.includes("|") &&
            speaker.length > existing.fullString.length)
        ) {
          existing.fullString = speaker;
        }
      } else {
        speakerMap.set(id, {
          fullString: speaker,
          appearsIn: new Set([listType]),
          countByList: { agree: 0, disagree: 0, no_clear: 0 },
        });
        speakerMap.get(id)!.countByList[listType] = 1;
      }
    }
  };

  processList(data.agree, "agree");
  processList(data.disagree, "disagree");
  processList(data.no_clear_position, "no_clear");

  return { speakerMap, inputCount };
}

/**
 * Log reconciliation metrics if significant changes were made.
 * Only logs when 3+ speakers affected OR 15%+ of total affected.
 */
function logReconciliationMetrics(params: {
  data: { agree: string[]; disagree: string[]; no_clear_position: string[] };
  outputAgree: string[];
  outputDisagree: string[];
  outputNoClear: string[];
  ambiguousIds: string[];
  removedFromNoClear: string[];
  inputCount: number;
}): void {
  const {
    data,
    outputAgree,
    outputDisagree,
    outputNoClear,
    ambiguousIds,
    removedFromNoClear,
    inputCount,
  } = params;

  const outputCount =
    outputAgree.length + outputDisagree.length + outputNoClear.length;
  const totalDuplicatesRemoved = inputCount - outputCount;

  const totalAffected =
    ambiguousIds.length + removedFromNoClear.length + totalDuplicatesRemoved;
  const percentageAffected =
    inputCount > 0 ? (totalAffected / inputCount) * 100 : 0;

  // Only log if reconciliation is "significant":
  // - Affects 3+ speakers (absolute threshold), OR
  // - Affects 15%+ of total speakers (relative threshold)
  const isSignificant = totalAffected >= 3 || percentageAffected >= 15;

  if (
    isSignificant &&
    (ambiguousIds.length > 0 ||
      removedFromNoClear.length > 0 ||
      totalDuplicatesRemoved > 0)
  ) {
    const reconcileLogger = browserLogger.child({
      module: "crux-reconciliation",
    });
    reconcileLogger.debug(
      {
        input: {
          agree: data.agree.filter((s) => extractSpeakerId(s) !== "").length,
          disagree: data.disagree.filter((s) => extractSpeakerId(s) !== "")
            .length,
          no_clear: data.no_clear_position.filter(
            (s) => extractSpeakerId(s) !== "",
          ).length,
        },
        output: {
          agree: outputAgree.length,
          disagree: outputDisagree.length,
          no_clear: outputNoClear.length,
        },
        ambiguousSpeakers: {
          count: ambiguousIds.length,
          speakerIds: ambiguousIds,
        },
        removedFromNoClear: {
          count: removedFromNoClear.length,
          speakerIds: removedFromNoClear,
        },
        totalSpeakers: {
          input: inputCount,
          output: outputCount,
          duplicatesRemoved: totalDuplicatesRemoved,
        },
        significance: {
          totalAffected,
          percentageAffected: Math.round(percentageAffected * 10) / 10,
        },
      },
      "Crux speaker reconciliation applied",
    );
  }
}

/**
 * Reconcile speaker positions across agree/disagree/no_clear_position lists
 *
 * **Problem**: LLM-generated crux data may contain speakers in multiple position lists,
 * which creates ambiguity about their true stance. This function resolves that ambiguity
 * using a priority-based system.
 *
 * **Reconciliation Rules** (in priority order):
 *
 * 1. **Ambiguous speakers** (appears in BOTH agree AND disagree):
 *    - Interpretation: Speaker has contradictory positions → truly ambiguous
 *    - Action: Move to `no_clear_position` (uses agree version of speaker data)
 *    - Example: Speaker says "I support X but also oppose X"
 *
 * 2. **Agree/disagree takes precedence** over no_clear_position:
 *    - If speaker is in agree AND no_clear → keep in agree (clear stance expressed)
 *    - If speaker is in disagree AND no_clear → keep in disagree (clear stance expressed)
 *    - Rationale: A clear position always overrides "unclear" classification
 *
 * 3. **Within-list deduplication**:
 *    - Remove duplicates within each individual list
 *    - First occurrence is kept, subsequent duplicates are dropped
 *
 * **Why use "agree version" for ambiguous speakers?**
 * When moving an ambiguous speaker to no_clear_position, we use their data from the
 * agree list. This is arbitrary but consistent - we need to pick one source for
 * speaker metadata (name, strength annotations, etc.), and agree is checked first.
 *
 * **Examples**:
 *
 * ```typescript
 * // Example 1: Ambiguous speaker
 * Input:  { agree: ["1:Alice"], disagree: ["1:Alice"], no_clear_position: [] }
 * Output: { agree: [], disagree: [], no_clear_position: ["1:Alice"] }
 *
 * // Example 2: Clear stance overrides unclear
 * Input:  { agree: ["1:Alice"], disagree: [], no_clear_position: ["1:Alice"] }
 * Output: { agree: ["1:Alice"], disagree: [], no_clear_position: [] }
 *
 * // Example 3: Multiple rules applied
 * Input:  { agree: ["1:Alice", "2:Bob", "2:Bob"], disagree: ["1:Alice"], no_clear_position: ["2:Bob"] }
 * Output: { agree: ["2:Bob"], disagree: [], no_clear_position: ["1:Alice"] }
 * // Alice: ambiguous → no_clear | Bob: duplicates removed, clear stance (agree) kept
 * ```
 *
 * @param data Raw crux data with potentially duplicate speakers
 * @returns Reconciled crux data with each speaker appearing in exactly one list
 * @public Exported for direct testing and reuse
 */
export function reconcileCruxSpeakers<
  T extends {
    agree: string[];
    disagree: string[];
    no_clear_position: string[];
  },
>(data: T): T {
  // PASS 1: Build speaker map from all three lists
  const { speakerMap, inputCount } = buildSpeakerMap(data);

  // PASS 2: Categorize speakers and build output lists (preserve original order)
  const outputAgree: string[] = [];
  const outputDisagree: string[] = [];
  const outputNoClear: string[] = [];
  const processedIds = new Set<string>();

  // Metrics tracking
  const ambiguousIds: string[] = [];
  const removedFromNoClear: string[] = [];

  // Helper to process a speaker from any list, maintaining order
  const processSpeaker = (speaker: string) => {
    const id = extractSpeakerId(speaker);
    if (!id || processedIds.has(id)) return; // Skip if already processed

    const info = speakerMap.get(id);
    if (!info) return; // Skip if not in map (invalid speaker)

    const { fullString, appearsIn } = info;
    processedIds.add(id);

    // Rule 1: Ambiguous speakers (in BOTH agree AND disagree) → no_clear_position
    if (appearsIn.has("agree") && appearsIn.has("disagree")) {
      ambiguousIds.push(id);
      outputNoClear.push(fullString);
      return;
    }

    // Rule 2: Clear stance (agree or disagree) takes precedence over no_clear
    if (appearsIn.has("agree")) {
      outputAgree.push(fullString);
      if (appearsIn.has("no_clear")) {
        removedFromNoClear.push(id);
      }
      return;
    }

    if (appearsIn.has("disagree")) {
      outputDisagree.push(fullString);
      if (appearsIn.has("no_clear")) {
        removedFromNoClear.push(id);
      }
      return;
    }

    // Rule 3: Only in no_clear → stays in no_clear
    if (appearsIn.has("no_clear")) {
      outputNoClear.push(fullString);
    }
  };

  // Track ambiguous speakers to append AFTER no_clear processing
  const ambiguousSpeakersToAppend: string[] = [];

  // Helper to process non-ambiguous speakers
  const processNonAmbiguousSpeaker = (speaker: string) => {
    const id = extractSpeakerId(speaker);
    if (!id || processedIds.has(id)) return;

    const info = speakerMap.get(id);
    if (!info) return;

    // Skip ambiguous speakers - they'll be added later
    if (info.appearsIn.has("agree") && info.appearsIn.has("disagree")) {
      // Only track once (from first list it appears in)
      if (!ambiguousSpeakersToAppend.some((s) => extractSpeakerId(s) === id)) {
        ambiguousSpeakersToAppend.push(info.fullString);
      }
      return;
    }

    processSpeaker(speaker);
  };

  // Process agree, disagree, then no_clear (preserving order within each list)
  // Ambiguous speakers are collected but not added yet
  data.agree.forEach(processNonAmbiguousSpeaker);
  data.disagree.forEach(processNonAmbiguousSpeaker);
  data.no_clear_position.forEach(processNonAmbiguousSpeaker);

  // Now append ambiguous speakers to no_clear (they go AFTER original no_clear speakers)
  ambiguousSpeakersToAppend.forEach((s) => processSpeaker(s));

  // Log metrics if significant reconciliation occurred
  logReconciliationMetrics({
    data,
    outputAgree,
    outputDisagree,
    outputNoClear,
    ambiguousIds,
    removedFromNoClear,
    inputCount,
  });

  return {
    ...data,
    agree: outputAgree,
    disagree: outputDisagree,
    no_clear_position: outputNoClear,
  };
}

export const subtopicCrux = z
  .object({
    topic: z.string(), // Parent topic name
    subtopic: z.string(), // Subtopic name
    cruxClaim: z.string(), // The synthesized controversial statement
    agree: z.array(z.string()), // Speaker IDs who would agree (format: "id:name")
    disagree: z.array(z.string()), // Speaker IDs who would disagree (format: "id:name")
    no_clear_position: z.array(z.string()).default([]), // Speaker IDs who mentioned topic but took no clear stance
    explanation: z.string(), // LLM's reasoning for why this divides participants
    agreementScore: z
      .number()
      .min(0, "Agreement score must be between 0 and 1")
      .max(1, "Agreement score must be between 0 and 1"), // 0-1: ratio of speakers who agree
    disagreementScore: z
      .number()
      .min(0, "Disagreement score must be between 0 and 1")
      .max(1, "Disagreement score must be between 0 and 1"), // 0-1: ratio of speakers who disagree
    controversyScore: z
      .number()
      .min(0, "Controversy score must be between 0 and 1")
      .max(1, "Controversy score must be between 0 and 1"), // 0-1: how evenly split (1.0 = perfect 50/50 split)
    speakersInvolved: z.number().int().nonnegative().optional(), // Total speakers who took a position (agree + disagree)
    totalSpeakersInSubtopic: z.number().int().nonnegative().optional(), // Total speakers with claims in this subtopic
  })
  .transform(reconcileCruxSpeakers)
  // Sanity check: Validate no speaker overlap after reconciliation
  // This refinement should always pass because reconcileCruxSpeakers guarantees
  // each speaker appears in exactly one list. However, we keep this validation as:
  // 1. Defense in depth - catches bugs in reconciliation logic
  // 2. Clear schema contract - documents the invariant
  // 3. Runtime assertion - helpful for debugging if reconciliation fails
  .refine(validateNoSpeakerOverlap, {
    message:
      "Speakers cannot appear in multiple position lists (agree, disagree, no_clear_position)",
  });

export type SubtopicCrux = z.infer<typeof subtopicCrux>;

/**
 * TopicScore: Aggregated controversy metrics for an entire topic.
 *
 * Rollup of all subtopic cruxes under a topic, enabling sorting of topics
 * by overall controversy level.
 *
 * Example:
 * {
 *   topic: "Healthcare Reform",
 *   averageControversy: 0.72,    // Mean controversy across 3 subtopics
 *   subtopicCount: 3,
 *   totalSpeakers: 5
 * }
 */
export const topicScore = z.object({
  topic: z.string(), // Topic name
  averageControversy: z.number(), // Mean controversyScore of all subtopics
  subtopicCount: z.number(), // Number of subtopics with cruxes
  totalSpeakers: z.number(), // Total unique speakers across topic
});

export type TopicScore = z.infer<typeof topicScore>;

/**
 * SpeakerCruxPosition: A speaker's position on a single crux.
 *
 * Simple enum for matrix visualization.
 *
 * Note: The field name "no_clear_position" (in SubtopicCrux) becomes "no_position"
 * (in this matrix enum). This terminology difference is intentional:
 * - "no_clear_position": Speakers who mentioned the subtopic but didn't take a clear stance
 * - "no_position": Generic matrix value for visualization (includes both no clear position
 *   and speakers who never mentioned the subtopic)
 */
export const speakerCruxPosition = z.enum(["agree", "disagree", "no_position"]);

export type SpeakerCruxPosition = z.infer<typeof speakerCruxPosition>;

/**
 * SpeakerCruxMatrix: Speaker × Crux agreement matrix for visualization.
 *
 * Shows voting patterns across all cruxes - which speakers align, which cruxes
 * are unanimous vs. divisive, and where data is missing.
 *
 * Structure:
 * - speakers: ["1:Alice", "2:Bob", "3:Charlie"]
 * - cruxLabels: ["AI Safety → Regulation", "Healthcare → Coverage"]
 * - matrix[speakerIndex][cruxIndex] = "agree" | "disagree" | "no_position"
 *
 * Example visualization:
 * ```
 *           Crux 1  Crux 2  Crux 3
 * Alice       ✓       ✗       ✓
 * Bob         ✗       ✗       ?
 * Charlie     ✓       ✓       ✗
 * ```
 */
export const speakerCruxMatrix = z.object({
  speakers: z.array(z.string()), // Speaker IDs in format "id:name"
  cruxLabels: z.array(z.string()), // Labels like "Topic → Subtopic"
  matrix: z.array(z.array(speakerCruxPosition)), // matrix[speakerIdx][cruxIdx]
});

export type SpeakerCruxMatrix = z.infer<typeof speakerCruxMatrix>;

/**
 * ClaimBridgingScore: Perspective API bridging attributes for a single claim.
 *
 * Scores claims on bridge-building qualities using Perspective API experimental attributes:
 * - personalStory: Contains personal experiences/anecdotes (builds empathy)
 * - reasoning: Contains logical argumentation (fosters understanding)
 * - curiosity: Expresses curiosity/questions (encourages dialogue)
 * - toxicity: Rude/divisive content (penalty multiplier)
 *
 * All scores are probabilities (0-1 range) from Perspective API.
 * Higher bridgingScore = more constructive, bridge-building content.
 *
 * bridgingScore formula: (personalStory + reasoning + curiosity) * (1 - toxicity)
 * Range: 0 to 3.0 (max when all positive attributes = 1.0 and toxicity = 0;
 *                  min/zero when toxicity = 1.0, completely disqualifying the content)
 */
export const claimBridgingScore = z.object({
  claimId: z.string(), // Claim ID from LLM extraction
  topicName: z.string(), // Parent topic
  subtopicName: z.string(), // Parent subtopic
  personalStory: z.number().min(0).max(1).finite(), // PERSONAL_STORY_EXPERIMENTAL score (0-1)
  reasoning: z.number().min(0).max(1).finite(), // REASONING_EXPERIMENTAL score (0-1)
  curiosity: z.number().min(0).max(1).finite(), // CURIOSITY_EXPERIMENTAL score (0-1)
  toxicity: z.number().min(0).max(1).finite(), // TOXICITY score (0-1)
  bridgingScore: z.number().min(0).max(3).finite(), // Composite score (0 to 3.0)
});

export type ClaimBridgingScore = z.infer<typeof claimBridgingScore>;

/**
 * QuoteBridgingScore: Perspective API bridging scores for individual quotes.
 *
 * Similar to ClaimBridgingScore but includes quote-specific context
 * for tracking individual participant communication styles.
 */
export const quoteBridgingScore = z.object({
  quoteId: z.string(), // Quote ID
  claimId: z.string(), // Parent claim ID for navigation/grouping
  topicName: z.string(), // Parent topic
  subtopicName: z.string(), // Parent subtopic
  speakerId: z.string(), // Source ID for per-speaker analysis
  interview: z.string(), // Speaker name for display
  personalStory: z.number().min(0).max(1).finite(), // PERSONAL_STORY_EXPERIMENTAL score (0-1)
  reasoning: z.number().min(0).max(1).finite(), // REASONING_EXPERIMENTAL score (0-1)
  curiosity: z.number().min(0).max(1).finite(), // CURIOSITY_EXPERIMENTAL score (0-1)
  toxicity: z.number().min(0).max(1).finite(), // TOXICITY score (0-1)
  bridgingScore: z.number().min(0).max(3).finite(), // Composite score (0 to 3.0)
});

export type QuoteBridgingScore = z.infer<typeof quoteBridgingScore>;

/**
 * AddOns: Container for optional research features.
 *
 * All fields optional - populated only when features are enabled in user config.
 *
 * Location in report: report.data[1].addOns
 * Enable via: cruxesEnabled checkbox in create form
 *
 * If addOns is {} or undefined, features were not enabled or data didn't meet requirements.
 */
export const addOns = z.object({
  subtopicCruxes: subtopicCrux.array().optional(), // One crux per qualifying subtopic with controversy scores
  topicScores: topicScore.array().optional(), // Topic-level rollups for sorting entire topics
  speakerCruxMatrix: speakerCruxMatrix.optional(), // Speaker × Crux voting pattern matrix
  claimBridgingScores: claimBridgingScore.array().optional(), // Perspective API bridging scores per claim
  quoteBridgingScores: quoteBridgingScore.array().optional(), // Perspective API bridging scores per quote
});

export type AddOns = z.infer<typeof addOns>;

export const llmPipelineOutput = z.object({
  data: z.array(sourceRow),
  title: z.string(),
  question: z.string(),
  pieChart: z.array(llmPieChart).optional(),
  description: z.string(),
  systemInstructions: z.string(),
  clusteringInstructions: z.string(),
  extractionInstructions: z.string(),
  batchSize: z.number(),
  tree: taxonomy,
  start: z.number(),
  costs: z.number(),
  end: z.number().optional(),
  duration: z.string().optional(),
  addOns: addOns.optional(),
});

export type LLMPipelineOutput = z.infer<typeof llmPipelineOutput>;

export const llmSourceMap = z.record(z.string(), sourceRow);

export type LLMSourceMap = z.infer<typeof llmSourceMap>;

/** VVVVVVVVVVVVVVVVVVVVVVVVVVVVV */
/********************************
 * UI FACING SCHEMA TYPES
 ********************************/
/** ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ */

/********************************
 * Sources
 * Sources are the material being referrenced, e.g. a video or interview.
 * There exists a one-to-many relationship between sources and referrences.
 ********************************/

export const textMediaSource = z.tuple([
  z.literal("text"),
  z.object({
    text: z.string(),
  }),
]);

export type TextMediaSource = z.infer<typeof textMediaSource>;

const videoMediaSource = z.tuple([
  z.literal("video"),
  z.object({
    text: z.string(),
    link: z.string(),
    timestamp: z.string().default("0:00:00"),
  }),
]);

const audioMediaSource = z.tuple([
  z.literal("audio"),
  z.object({
    link: z.string(),
  }),
]);

// Maybe author or metadata ??

const mediaSources = z.union([
  textMediaSource,
  videoMediaSource,
  audioMediaSource,
]);

export const source = z.object({
  id: z.string(),
  interview: z.string().default("Anonymous"),
  data: mediaSources,
});

export type Source = z.infer<typeof source>;

/********************************
 * References
 * Maybe call it excerpts?
 * References should point at where in the source is being used.
 ********************************/

const referenceText = z.tuple([
  z.literal("text"),
  z.object({
    startIdx: z.number(),
    endIdx: z.number(),
  }),
]);

export type ReferenceText = z.infer<typeof referenceText>;

const referenceVideo = z.tuple([
  z.literal("video"),
  z.object({
    link: z.string(),
    beginTimestamp: z.string(),
    endTimestamp: z.string().optional(),
  }),
]);

export type ReferenceVideo = z.infer<typeof referenceVideo>;

const referenceAudio = z.tuple([
  z.literal("audio"),
  z.object({
    beginTimestamp: z.string(),
    endTimestamp: z.string().optional(),
  }),
]);

export const reference = z.object({
  id: z.string(),
  sourceId: z.string(),
  interview: z.string().default("Anonymous"),
  data: z.union([referenceText, referenceVideo, referenceAudio]),
});

export type Referece = z.infer<typeof reference>;

/********************************
 * Quote
 * Quotes are objects used in the Report to show the user what was specifically said
 ********************************/
export const quote = z.object({
  id: z.string(),
  text: z.string(),
  reference: reference,
});

export type Quote = z.infer<typeof quote>;

/********************************
 * Claim
 * Claims are specific points made that are derived from the source material
 * They also contain an array of similarly made claims
 ********************************/
// Zod has trouble with self-referential types, so leave this be until we need to parse
export type Claim = {
  id: string;
  title: string;
  quotes: Quote[];
  similarClaims: Claim[];
  number: number;
};

export const claim = z.custom<Claim>();

/********************************
 * Subtopic
 * Subtopic are categories of claims that share some relation.
 ********************************/
export const subtopic = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  claims: z.array(claim),
});

export type Subtopic = z.infer<typeof subtopic>;

/**
 * This is the list of colors that we use at the moment, but don't make this hard coded into the schema so we can change colors if necessary.
 */
export const topicColors = z.enum([
  "violet",
  "blueSea",
  "blueSky",
  "greenLeaf",
  "greenLime",
  "yellow",
  "red",
  "purple",
  "brown",
]);

export type TopicColors = z.infer<typeof topicColors>;

/********************************
 * Topic
 * Topics are broader categories of topics
 ********************************/
export const topic = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  summary: z.string().optional(),
  context: z.string().optional(),
  subtopics: z.array(subtopic),
  topicColor: topicColors,
});

export type Topic = z.infer<typeof topic>;
/********************************
 * Graphics
 * Graphics are object level representations of graphics that are added to the report
 * TODO Make note about cell graphic things not being this
 ********************************/

const pieChartGraphic = z.tuple([
  z.literal("piechart"),
  z.object({
    title: z.string(),
    items: z.object({ label: z.string(), count: z.number() }).array(),
  }),
]);

const graphics = pieChartGraphic; // make this a union when we have more

/********************************
 * Question and Answer
 * Included in the Report summary, gives the creator an opportunity to answer questions about getting data, etc
 ********************************/

export const questionAnswer = z.object({
  question: z.string(),
  answer: z.string(),
});

export type QuestionAnswer = z.infer<typeof questionAnswer>;

/********************************
 * Report Data
 * Contains all the information that a report needs to display
 ********************************/

export const reportDataObj = z.object({
  title: z.string(),
  description: z.string(),
  questionAnswers: z.optional(questionAnswer.array()),
  addOns: addOns.optional(),
  topics: z.array(topic).transform((topics) =>
    topics.sort((a, b) => {
      const setSpeakersA = new Set(
        a.subtopics.flatMap((sub) =>
          sub.claims.flatMap((c) =>
            c.quotes.flatMap((q) => q.reference.interview),
          ),
        ),
      );
      const setSpeakersB = new Set(
        new Set(
          b.subtopics.flatMap((sub) =>
            sub.claims.flatMap((c) =>
              c.quotes.flatMap((q) => q.reference.interview),
            ),
          ),
        ),
      );
      return setSpeakersB.size - setSpeakersA.size;
      // leave this here for now until we start handling sorting by both.
      // const claimsA = a.subtopics.flatMap((sub) => sub.claims);
      // const claimsB = b.subtopics.flatMap((sub) => sub.claims);
      // return claimsB.length - claimsA.length;
    }),
  ),
  sources: z.array(source),
  graphics: graphics.optional(),
  date: z.string(),
});

export type ReportDataObj = z.infer<typeof reportDataObj>;

/********************************
 * Report Versions
 * Report schemas are versioned in case future reports need to include breaking changes
 ********************************/

const v0_2_Report = z.tuple([z.literal("v0.2"), reportDataObj]);

const reportData = v0_2_Report; // make union when we have more versions

/********************************
 * Report Metadata
 * Contains information not revealed in the report
 * This information can be useful for things like running experiments and tracking costs
 ********************************/

// template + optional text
export const openAIModels = z.enum([
  "gpt-4",
  "gpt-4-32k",
  "gpt-3.5-turbo",
  "gpt-3.5-turbo-16k",
  "gpt-4-turbo-preview",
  "code-davinci-002",
  "code-cushman-001",
  "text-embedding-ada-002",
  "text-davinci-003",
  "text-curie-001",
  "text-babbage-001",
  "text-ada-001",
]);

const anthropicModels = z.enum([
  "claude-v1",
  "claude-v1-100k",
  "claude-instant-v1",
  "claude-instant-v1-100k",
  "claude-v1.2",
  "claude-v1.2-100k",
  "claude-v1.3",
  "claude-v1.3-100k",
  "claude-v1.3.1",
  "claude-v1.3.1-100k",
  "claude-v1.4",
  "claude-v1.4-100k",
]);

const models = z.union([openAIModels, anthropicModels]);

export const pipelineStages = z.enum([
  "systemInstructions",
  "clusteringInstructions",
  "extractionInstructions",
  "dedupInstructions",
]);

const tokenCount = z.object({
  sent: z.number(),
  received: z.number(),
  total: z.number(),
});

const cost = z.object({
  denomination: z.union([z.literal("$"), z.literal("£"), z.literal("€")]), // add any more we need here
  value: z.number(),
});

export const pipelineStepData = z.object({
  temperature: z.number(),
  tokenCount,
  costPerToken: cost,
  model: models,
  batchSize: z.number(),
  instructions: z.string(),
});

export type PipelineStepData = z.infer<typeof pipelineStepData>;

export const pipelineStep = z.tuple([pipelineStages, pipelineStepData]);

export type PipelineStep = z.infer<typeof pipelineStep>;

export const reportMetadataObj = z.object({
  // buildProcess: z.array(pipelineStep),
  startTimestamp: z.number(),
  duration: z.number(),
  totalCost: z.string(),
  author: z.string(),
  organization: z.string().optional(),
});

export type ReportMetadataObj = z.infer<typeof reportMetadataObj>;

/********************************
 * Pipeline Versions
 * Pipeline is versioned in case of breaking changes
 ********************************/

const v0_2_ReportMetadata = z.tuple([z.literal("v0.2"), reportMetadataObj]);

const reportMetadata = v0_2_ReportMetadata; // make union when we have more versions

/********************************
 * Processing Audit Log
 * Tracks comment processing decisions for transparency and debugging
 * Defined here before PipelineOutput since it's referenced there
 ********************************/

export const auditLogEntry = z.object({
  // Entry identification
  entryId: z.string().optional(), // Primary identifier for any entry type (optional for backward compatibility with older reports)
  entryType: z.string().default("comment"), // "comment" | "crux_validation" | etc.
  commentId: z.string().optional(), // Only for comment-related entries
  commentText: z.string().optional(), // Excluded from stored artifact for privacy
  textPreview: z.string().optional(), // First 200 chars of comment for human readability
  interview: z.string().optional(), // Speaker/interview name from CSV
  step: z.enum([
    "input",
    "sanitization_filter",
    "meaningfulness_filter",
    "claims_extraction",
    "deduplication",
    "crux_generation_validation",
  ]),
  action: z.enum([
    "received",
    "accepted",
    "rejected",
    "modified",
    "deduplicated",
  ]),
  reason: z.string().optional(),
  details: z.record(z.unknown()).optional(),
  timestamp: z.string(),
  // Additional tracking fields
  commentLength: z.number().optional(), // Length of comment text
  claimsExtracted: z.number().optional(), // Number of claims extracted from this comment
  claimIds: z.array(z.string()).optional(), // IDs of claims generated from this comment
  topicAssignments: z.array(z.string()).optional(), // Topics/subtopics this claim was assigned to
  deduplicatedWith: z.array(z.string()).optional(), // IDs of claims this was merged with (DEPRECATED)
  primaryClaimId: z.string().optional(), // For deduplication: the surviving claim ID
  mergedClaimIds: z.array(z.string()).optional(), // For deduplication: all claims merged into primary
});

export type AuditLogEntry = z.infer<typeof auditLogEntry>;

export const processingAuditLog = z.object({
  version: z.literal("1.0").default("1.0"), // Audit log schema version for future migrations
  reportId: z.string(),
  createdAt: z.string(),
  inputCommentCount: z.number(),
  finalQuoteCount: z.number(),
  modelName: z.string(), // Single model used for all LLM operations in this report
  entries: z.array(auditLogEntry),
  summary: z.object({
    rejectedBySanitization: z.number(),
    rejectedByMeaningfulness: z.number(),
    rejectedByClaimsExtraction: z.number(),
    deduplicated: z.number(),
    accepted: z.number(),
    // Crux generation validation metrics
    cruxValidationFailures: z.number().optional(), // Subtopics with complete validation failure
    cruxValidationRecovered: z.number().optional(), // Subtopics with partial failures but recovered
  }),
});

export type ProcessingAuditLog = z.infer<typeof processingAuditLog>;

/********************************
 * Pipeline output
 * What the object received from the LLM pipeline should look like.
 ********************************/

export const pipelineOutput = z.object({
  data: reportData,
  metadata: reportMetadata,
  auditLog: processingAuditLog.optional(),
});

export type PipelineOutput = z.infer<typeof pipelineOutput>;

/********************************
 * UI Report
 * Data needed only to display a report
 ********************************/

export const uiReportData = reportDataObj.omit({ sources: true });

export type UIReportData = z.infer<typeof uiReportData>;

/********************************
 * Downloaded report
 * When a user downloads a report, it gives a partial report object with some extra metadata
 ********************************/

const downloadReportSchema_v1 = z.tuple([
  z.literal("v0.2"),
  z.object({
    data: z.tuple([z.literal("v0.2"), uiReportData]),
    downloadTimestamp: z.number(),
  }),
]);

export const downloadReportSchema = downloadReportSchema_v1;

export type DownloadDataReportSchema = z.infer<typeof downloadReportSchema>;
