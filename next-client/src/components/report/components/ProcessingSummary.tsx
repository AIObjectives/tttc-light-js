"use client";

import { useState } from "react";
import type * as schema from "tttc-common/schema";
import Icons from "@/assets/icons";
import { Col, Row } from "@/components/layout";

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

interface ProcessingSummaryProps {
  auditLog: schema.ProcessingAuditLog;
}

export function ProcessingSummary({ auditLog }: ProcessingSummaryProps) {
  const { inputCommentCount, createdAt, modelName, summary, entries } =
    auditLog;

  // Get merge entries for expandable section
  const mergeEntries =
    entries?.filter((e) => e.action === "deduplicated") ?? [];
  const rejectedEntries = entries?.filter((e) => e.action === "rejected") ?? [];

  // Use summary.accepted for final count, fall back to calculation
  const finalQuoteCount = summary?.accepted ?? 0;

  const [isOpen, setIsOpen] = useState(false);

  return (
    <Col gap={2} className="mt-6">
      {/* Section header with right-side chevron for consistency */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 cursor-pointer select-none text-left"
        aria-expanded={isOpen}
      >
        <span>
          Processing summary{" "}
          <span className="text-muted-foreground text-sm font-normal">
            ({formatNumber(inputCommentCount)} comments
            {finalQuoteCount > 0 &&
              ` → ${formatNumber(finalQuoteCount)} quotes`}
            )
          </span>
        </span>
        {isOpen ? (
          <Icons.OutlineExpanded className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Icons.OutlineCollapsed className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Collapsible content */}
      {isOpen && (
        <div className="text-muted-foreground">
          <Col gap={4} className="text-sm mt-2">
            {/* Simple stats list */}
            {summary && (
              <Col gap={2}>
                <StatLine
                  icon="↓"
                  text={`${formatNumber(inputCommentCount)} comments received`}
                />

                {summary.rejectedBySanitization > 0 && (
                  <ExpandableStat
                    icon="✗"
                    count={summary.rejectedBySanitization}
                    label="removed by content filter"
                    explanation="formatting issues or prohibited content"
                    entries={rejectedEntries.filter(
                      (e) => e.step === "sanitization_filter",
                    )}
                  />
                )}

                {summary.rejectedByMeaningfulness > 0 && (
                  <ExpandableStat
                    icon="✗"
                    count={summary.rejectedByMeaningfulness}
                    label="removed by relevance filter"
                    explanation="lacking meaningful content"
                    entries={rejectedEntries.filter(
                      (e) => e.step === "meaningfulness_filter",
                    )}
                  />
                )}

                {summary.rejectedByClaimsExtraction > 0 && (
                  <ExpandableStat
                    icon="✗"
                    count={summary.rejectedByClaimsExtraction}
                    label="had no extractable quotes"
                    explanation="no specific claims found"
                    entries={rejectedEntries.filter(
                      (e) => e.step === "claims_extraction",
                    )}
                  />
                )}

                {summary.deduplicated > 0 && (
                  <ExpandableStat
                    icon="⊕"
                    count={summary.deduplicated}
                    label="similar claims grouped"
                    explanation="LLM identified as semantically similar"
                    entries={mergeEntries}
                  />
                )}

                {finalQuoteCount > 0 && (
                  <StatLine
                    icon="→"
                    text={`${formatNumber(finalQuoteCount)} quotes in final report`}
                    highlight
                  />
                )}
              </Col>
            )}

            {/* Theme generation stats */}
            {summary &&
              (summary.cruxValidationFailures !== undefined ||
                summary.cruxValidationRecovered !== undefined) && (
                <Col gap={1}>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">
                    Theme generation
                  </p>
                  {summary.cruxValidationRecovered !== undefined &&
                    summary.cruxValidationRecovered > 0 && (
                      <StatLine
                        icon="⚠"
                        text={`${formatNumber(summary.cruxValidationRecovered)} subtopics recovered after partial failures`}
                      />
                    )}
                  {summary.cruxValidationFailures !== undefined &&
                    summary.cruxValidationFailures > 0 && (
                      <StatLine
                        icon="✗"
                        text={`${formatNumber(summary.cruxValidationFailures)} subtopics failed theme generation`}
                        variant="error"
                      />
                    )}
                  {summary.cruxValidationFailures === 0 &&
                    summary.cruxValidationRecovered === 0 && (
                      <StatLine
                        icon="✓"
                        text="All themes generated successfully"
                        variant="success"
                      />
                    )}
                </Col>
              )}

            {/* Metadata */}
            <Row gap={2} className="text-xs text-muted-foreground flex-wrap">
              {createdAt && <span>Generated: {formatDate(createdAt)}</span>}
              {createdAt && modelName && <span>•</span>}
              {modelName && <span>Model: {modelName}</span>}
            </Row>
          </Col>
        </div>
      )}
    </Col>
  );
}

/**
 * Simple stat line with icon
 */
function StatLine({
  icon,
  text,
  highlight,
  variant,
}: {
  icon: string;
  text: string;
  highlight?: boolean;
  variant?: "error" | "success";
}) {
  let colorClass = "text-muted-foreground";
  if (variant === "error") colorClass = "text-destructive";
  if (variant === "success") colorClass = "text-green-600 dark:text-green-400";
  if (highlight) colorClass = "text-foreground font-medium";

  return (
    <div className={`flex items-start gap-2 ${colorClass}`}>
      <span className="w-4 text-center flex-shrink-0" aria-hidden="true">
        {icon}
      </span>
      <span>{text}</span>
    </div>
  );
}

/**
 * Type for deduplication details stored in audit log
 */
interface DeduplicationDetails {
  primary_claim?: {
    text?: string;
    speaker?: string;
  };
  merged_claims?: Array<{
    text?: string;
    speaker?: string;
  }>;
  /** AI-generated summary of the grouped claims */
  grouped_claim?: string;
  num_claims_merged?: number;
  /** Topic path e.g. "Historical Reflections/Lessons from Rome" */
  topic?: string;
}

/**
 * Parsed deduplication group from audit log entry
 * Each entry already contains all merged claims - no need to re-group
 */
interface DeduplicationGroup {
  survivingClaim: string;
  survivingSpeaker?: string;
  mergedClaims: Array<{ text: string; speaker?: string }>;
  /** AI-generated summary of the group */
  groupedClaim?: string;
  /** Topic path e.g. "Historical Reflections/Lessons from Rome" */
  topic?: string;
}

/**
 * Extract merged claims from deduplication details
 */
function extractMergedClaims(
  details: DeduplicationDetails,
): Array<{ text: string; speaker?: string }> {
  if (!details.merged_claims) return [];

  return details.merged_claims
    .filter((claim): claim is { text: string; speaker?: string } =>
      Boolean(claim.text),
    )
    .map((claim) => ({
      text: claim.text,
      speaker: claim.speaker,
    }));
}

/**
 * Convert a single audit log entry to a deduplication group
 */
function entryToDeduplicationGroup(
  entry: schema.AuditLogEntry,
): DeduplicationGroup | null {
  const details = entry.details as DeduplicationDetails;
  const survivingClaim = details.primary_claim?.text;
  if (!survivingClaim) return null;

  return {
    survivingClaim,
    survivingSpeaker: details.primary_claim?.speaker,
    mergedClaims: extractMergedClaims(details),
    groupedClaim: details.grouped_claim,
    topic: details.topic,
  };
}

/**
 * Parse deduplication entries from audit log
 * Each entry already contains the primary claim and ALL merged claims
 */
function parseDeduplicationEntries(
  entries: schema.AuditLogEntry[],
): DeduplicationGroup[] {
  return entries
    .filter((entry) => entry.action === "deduplicated" && entry.details)
    .map(entryToDeduplicationGroup)
    .filter((group): group is DeduplicationGroup => group !== null);
}

/**
 * Truncatable text that can be clicked to expand
 */
function TruncatableText({
  text,
  maxLength,
  className,
  title,
}: {
  text: string;
  maxLength: number;
  className?: string;
  title?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isTruncated = text.length > maxLength;
  const displayText =
    isTruncated && !isExpanded ? `${text.slice(0, maxLength)}...` : text;

  if (!isTruncated) {
    return (
      <p className={className} title={title}>
        {text}
      </p>
    );
  }

  return (
    <p className={className} title={title}>
      {displayText}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="ml-1 text-muted-foreground/50 hover:text-muted-foreground underline text-xs"
      >
        {isExpanded ? "less" : "more"}
      </button>
    </p>
  );
}

/**
 * Card showing all claims grouped into a single surviving claim
 * These are LLM-extracted claims (assertions), not verbatim participant quotes
 *
 * Visual order: Surviving claim FIRST (what's in the report), then expandable
 * "Why grouped?" section containing AI explanation and merged claims
 */
function GroupedClaimsCard({ group }: { group: DeduplicationGroup }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Build hover text for speaker attribution
  const getSpeakerHoverText = (speaker?: string) =>
    speaker
      ? `Extracted from comment by: ${speaker}\n(This is an LLM interpretation, not a verbatim quote)`
      : "Speaker information not available";

  // Extract subtopic from topic path (e.g., "Historical Reflections/Lessons from Rome" → "Lessons from Rome")
  const subtopic = group.topic?.split("/").pop();

  const hasMergedClaims = group.mergedClaims.length > 0;

  return (
    <div className="border-l-2 border-muted pl-3 py-2 text-sm">
      {/* Topic tag */}
      {subtopic && (
        <p className="text-muted-foreground/40 text-xs mb-1">{subtopic}</p>
      )}

      {/* The surviving claim FIRST - this is what's in the report */}
      <TruncatableText
        text={group.survivingClaim}
        maxLength={150}
        className="text-foreground text-sm font-medium"
        title={getSpeakerHoverText(group.survivingSpeaker)}
      />

      {/* "Why grouped?" expandable section containing explanation + merged claims */}
      {hasMergedClaims && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-muted-foreground/50 text-xs cursor-pointer hover:text-muted-foreground/70 flex items-center gap-1"
          >
            <span>
              {group.mergedClaims.length === 1
                ? "1 similar claim grouped"
                : `${group.mergedClaims.length} similar claims grouped`}
            </span>
            {isExpanded ? (
              <Icons.OutlineExpanded className="h-3 w-3" />
            ) : (
              <Icons.OutlineCollapsed className="h-3 w-3" />
            )}
          </button>

          {isExpanded && (
            <div className="ml-4 mt-2 space-y-2">
              {/* AI explanation first */}
              {group.groupedClaim && (
                <p className="text-muted-foreground/60 text-xs border-l-2 border-muted/30 pl-2">
                  <span className="font-medium">Reason:</span>{" "}
                  <span className="italic">{group.groupedClaim}</span>
                </p>
              )}

              {/* Then the merged claims as a bulleted list */}
              <ul className="space-y-1 list-none">
                {group.mergedClaims.map((claim, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-muted-foreground/40 text-xs leading-4">
                      •
                    </span>
                    <TruncatableText
                      text={claim.text}
                      maxLength={100}
                      className="text-muted-foreground/60 text-xs"
                      title={getSpeakerHoverText(claim.speaker)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Expandable stat that shows individual entries when clicked
 */
function ExpandableStat({
  icon,
  count,
  label,
  explanation,
  entries,
}: {
  icon: string;
  count: number;
  label: string;
  explanation: string;
  entries: schema.AuditLogEntry[];
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(5);

  const hasEntries = entries.length > 0;

  // Check if these are deduplication entries - if so, parse them
  const isDeduplication = hasEntries && entries[0]?.action === "deduplicated";
  const dedupGroups = isDeduplication
    ? parseDeduplicationEntries(entries)
    : null;

  const visibleEntries = entries.slice(0, visibleCount);
  const visibleGroups = dedupGroups?.slice(0, visibleCount) ?? [];
  const totalItems = dedupGroups?.length ?? entries.length;
  const hasMore = visibleCount < totalItems;

  return (
    <div className="text-muted-foreground">
      <button
        type="button"
        onClick={() => hasEntries && setIsExpanded(!isExpanded)}
        className={`flex items-start gap-2 text-left w-full ${
          hasEntries ? "cursor-pointer hover:text-foreground" : "cursor-default"
        }`}
        disabled={!hasEntries}
      >
        <span className="w-4 text-center flex-shrink-0" aria-hidden="true">
          {icon}
        </span>
        <span className="flex-1">
          {formatNumber(count)} {label}
          <span className="text-muted-foreground/70"> — {explanation}</span>
          {hasEntries && (
            <span className="text-muted-foreground/50 ml-1 inline-flex items-center">
              {isExpanded ? (
                <Icons.OutlineExpanded className="h-3 w-3" />
              ) : (
                <Icons.OutlineCollapsed className="h-3 w-3" />
              )}
            </span>
          )}
        </span>
      </button>

      {/* Expanded entries list - mobile-friendly vertical cards */}
      {isExpanded && hasEntries && (
        <div className="ml-6 mt-2 space-y-3">
          {/* Explanatory intro for deduplication */}
          {isDeduplication && (
            <p className="text-xs text-muted-foreground/70 pb-1">
              When participants expressed similar ideas, the AI grouped them
              under one representative claim. The bold claim appears in the
              report.
            </p>
          )}
          {isDeduplication
            ? visibleGroups.map((group, idx) => (
                <GroupedClaimsCard
                  key={group.survivingClaim || idx}
                  group={group}
                />
              ))
            : visibleEntries.map((entry, idx) => (
                <EntryCard key={entry.entryId || idx} entry={entry} />
              ))}

          {hasMore && (
            <button
              type="button"
              onClick={() => setVisibleCount((prev) => prev + 10)}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Show more ({totalItems - visibleCount} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Individual entry card - shows quote preview and reason
 * Used for non-deduplication entries (rejected, etc.)
 */
function EntryCard({ entry }: { entry: schema.AuditLogEntry }) {
  return <StandardEntryCard entry={entry} />;
}

/**
 * Standard entry card for non-deduplication entries (rejected, etc.)
 */
function StandardEntryCard({ entry }: { entry: schema.AuditLogEntry }) {
  const hasPreview = Boolean(entry.textPreview?.trim());
  const preview = hasPreview
    ? entry.textPreview!.length > 150
      ? `${entry.textPreview!.slice(0, 150)}...`
      : entry.textPreview
    : null;

  // Build a label from available info
  const isNumericId = entry.commentId && /^\d+$/.test(entry.commentId.trim());
  const rowNumber = isNumericId ? Number(entry.commentId) + 1 : null;
  const recordId = !isNumericId && entry.commentId ? entry.commentId : null;

  let sourceLabel: string | null = null;
  if (entry.interview && rowNumber) {
    sourceLabel = `${entry.interview}, Row ${rowNumber}`;
  } else if (entry.interview && recordId) {
    sourceLabel = `${entry.interview}, ID: ${recordId}`;
  } else if (entry.interview) {
    sourceLabel = entry.interview;
  } else if (rowNumber) {
    sourceLabel = `Row ${rowNumber}`;
  } else if (recordId) {
    sourceLabel = `ID: ${recordId}`;
  }

  return (
    <div className="border-l-2 border-muted pl-3 py-1 text-sm">
      {preview ? (
        <>
          <p className="text-muted-foreground/80 italic">"{preview}"</p>
          {entry.reason && (
            <p className="text-muted-foreground/70 text-xs mt-1">
              {entry.reason}
              {sourceLabel && (
                <span className="text-muted-foreground/50">
                  {" "}
                  — {sourceLabel}
                </span>
              )}
            </p>
          )}
        </>
      ) : sourceLabel && entry.reason ? (
        <p className="text-muted-foreground/70">
          <span className="text-muted-foreground/60">{sourceLabel}</span>
          <span className="mx-1">—</span>
          <span>{entry.reason}</span>
        </p>
      ) : sourceLabel ? (
        <p className="text-muted-foreground/60 italic">[{sourceLabel}]</p>
      ) : entry.reason ? (
        <p className="text-muted-foreground/70">{entry.reason}</p>
      ) : (
        <p className="text-muted-foreground/60 italic">
          [Content not available]
        </p>
      )}
    </div>
  );
}
