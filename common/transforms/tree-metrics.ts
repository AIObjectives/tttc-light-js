import type * as schema from "../schema/";

/**
 * Tree Metrics
 *
 * Utility functions for computing metrics across the report tree structure.
 * The report tree hierarchy is: Report -> Topics -> Subtopics -> Claims -> Quotes -> References
 *
 * These functions traverse the tree to extract and count unique participants (interviews).
 */

// ============================================================================
// Internal helpers - collect data from tree levels
// ============================================================================

function collectReferencesFromQuotes(
  quotes: schema.Quote[],
): schema.Reference[] {
  return quotes.flatMap((q) => q.reference);
}

function collectQuotesFromClaims(claims: schema.Claim[]): schema.Quote[] {
  return [
    ...claims.flatMap((c) => c.quotes),
    ...claims.flatMap((c) => c.similarClaims.flatMap((sc) => sc.quotes)),
  ];
}

function collectClaimsFromSubtopics(
  subtopics: schema.Subtopic[],
): schema.Claim[] {
  return subtopics.flatMap((s) => s.claims);
}

function collectSubtopicsFromTopics(topics: schema.Topic[]): schema.Subtopic[] {
  return topics.flatMap((t) => t.subtopics);
}

/**
 * Extract unique interview identifiers from references.
 * Falls back to generating unique IDs if interview field is missing.
 */
function countUniqueInterviews(references: schema.Reference[]): number {
  return new Set(references.map((ref, i) => ref.interview ?? `ref-${i}`)).size;
}

// ============================================================================
// Public API - explicit functions for each tree level
// ============================================================================

/**
 * Count unique participants from an array of claims.
 */
export function getNPeopleFromClaims(claims: schema.Claim[]): number {
  if (claims.length === 0) return 0;
  const quotes = collectQuotesFromClaims(claims);
  const references = collectReferencesFromQuotes(quotes);
  return countUniqueInterviews(references);
}

/**
 * Count unique participants from an array of subtopics.
 */
export function getNPeopleFromSubtopics(subtopics: schema.Subtopic[]): number {
  if (subtopics.length === 0) return 0;
  return getNPeopleFromClaims(collectClaimsFromSubtopics(subtopics));
}

/**
 * Count unique participants from an array of topics.
 */
export function getNPeopleFromTopics(topics: schema.Topic[]): number {
  if (topics.length === 0) return 0;
  return getNPeopleFromSubtopics(collectSubtopicsFromTopics(topics));
}

/**
 * Count unique participants from a report.
 */
export function getNPeopleFromReport(report: schema.ReportDataObj): number {
  return getNPeopleFromTopics(report.topics);
}

// ============================================================================
// Other utilities
// ============================================================================

/**
 * Count total claims across subtopics.
 */
export function getNClaims(subtopics: schema.Subtopic[]): number {
  return subtopics.flatMap((s) => s.claims).length;
}

/**
 * Get all quotes from a claim, including quotes from similar claims.
 */
export function getQuotes(claim: schema.Claim): schema.Quote[] {
  return claim.quotes.concat(claim.similarClaims.flatMap((c) => c.quotes));
}
