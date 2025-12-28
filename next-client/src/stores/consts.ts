/**
 * Pagination constants for report state management.
 * These control how many items are initially shown and how many are added per expansion.
 */

/** Initial subtopics shown per topic (0-indexed, so 1 = show 2) */
export const defaultTopicPagination = 1;
/** Additional subtopics shown on expand */
export const defaultAddTopicPagination = 2;

/** Initial claims shown per subtopic (0-indexed, so 7 = show 8) */
export const defaultSubtopicPagination = 7;
/** Additional claims shown on expand */
export const defaultAddSubtopicPagination = 9;
