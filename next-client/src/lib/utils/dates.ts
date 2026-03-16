/**
 * Dates from the server are stored as UTC timestamps (e.g. "2026-03-20T01:00:00Z").
 * Calling toLocaleDateString() on them directly shows the wrong day in timezones
 * behind UTC. This function reconstructs a local-midnight Date from the UTC date
 * parts so display is always correct regardless of the viewer's timezone.
 */
export function utcDateToLocal(date: Date): Date {
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
