/**
 * Backward-compatible export of useUnifiedReport hook.
 *
 * This hook has been migrated to use TanStack Query for improved caching,
 * automatic polling, and better error handling. The API remains unchanged
 * for backward compatibility with existing consumers.
 *
 * @see useUnifiedReportQuery for the TanStack Query implementation
 */

export type { ReportState } from "./useUnifiedReportQuery";
export { useUnifiedReportQuery as useUnifiedReport } from "./useUnifiedReportQuery";
