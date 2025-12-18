"use client";

import React, { useState } from "react";
import * as schema from "tttc-common/schema";
import { Col, Row } from "@/components/layout";
import { ToggleText } from "@/components/elements";

/**
 * User-friendly labels for technical audit log terms
 */
const STEP_LABELS: Record<string, string> = {
  input: "Input",
  sanitization_filter: "Content filter",
  meaningfulness_filter: "Relevance filter",
  claims_extraction: "Quote extraction",
  deduplication: "Duplicate removal",
  crux_generation_validation: "Theme generation",
};

const ACTION_LABELS: Record<string, string> = {
  received: "Received",
  accepted: "Included",
  rejected: "Excluded",
  modified: "Modified",
  deduplicated: "Merged",
};

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  // new Date() returns Invalid Date (not an exception) for invalid inputs
  if (isNaN(date.getTime())) {
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
  const { inputCommentCount, finalQuoteCount, createdAt, modelName, summary } =
    auditLog;

  return (
    <Col gap={2} className="mt-6">
      <ToggleText>
        <ToggleText.Title>
          Processing summary{" "}
          <span className="text-muted-foreground text-sm font-normal">
            ({formatNumber(inputCommentCount)} comments &rarr;{" "}
            {formatNumber(finalQuoteCount)} quotes)
          </span>
        </ToggleText.Title>
        <ToggleText.Content>
          <Col gap={3} className="text-sm mt-2">
            {/* Filtering breakdown */}
            {summary && (
              <Col gap={1}>
                <p className="text-muted-foreground text-xs uppercase tracking-wide">
                  Filtering breakdown
                </p>
                <ul className="space-y-1">
                  {summary.rejectedBySanitization > 0 && (
                    <li>
                      &bull; Content filter:{" "}
                      {formatNumber(summary.rejectedBySanitization)} excluded
                    </li>
                  )}
                  {summary.rejectedByMeaningfulness > 0 && (
                    <li>
                      &bull; Relevance filter:{" "}
                      {formatNumber(summary.rejectedByMeaningfulness)} excluded
                    </li>
                  )}
                  {summary.rejectedByClaimsExtraction > 0 && (
                    <li>
                      &bull; No extractable quotes:{" "}
                      {formatNumber(summary.rejectedByClaimsExtraction)}
                    </li>
                  )}
                  {summary.deduplicated > 0 && (
                    <li>
                      &bull; Merged as duplicates:{" "}
                      {formatNumber(summary.deduplicated)}
                    </li>
                  )}
                  <li>
                    &bull; Included in report: {formatNumber(summary.accepted)}
                  </li>
                </ul>
              </Col>
            )}

            {/* Metadata */}
            <Row gap={2} className="text-xs text-muted-foreground flex-wrap">
              {createdAt && <span>Generated: {formatDate(createdAt)}</span>}
              {createdAt && modelName && <span>&bull;</span>}
              {modelName && <span>Model: {modelName}</span>}
            </Row>

            {/* Nested expandable entries table */}
            {auditLog.entries && auditLog.entries.length > 0 && (
              <ProcessingEntriesSection entries={auditLog.entries} />
            )}
          </Col>
        </ToggleText.Content>
      </ToggleText>
    </Col>
  );
}

interface ProcessingEntriesSectionProps {
  entries: schema.AuditLogEntry[];
}

const PAGE_SIZE = 50;
const LOG_TABLE_MAX_HEIGHT = "400px";
const TEXT_PREVIEW_MAX_LENGTH = 80;
const COMMENT_COLUMN_MAX_WIDTH = "200px";

function ProcessingEntriesSection({ entries }: ProcessingEntriesSectionProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Filter to entries that have useful display info (excluded or modified items)
  const displayableEntries = entries.filter(
    (e) =>
      e.action === "rejected" ||
      e.action === "deduplicated" ||
      e.action === "modified",
  );

  if (displayableEntries.length === 0) {
    return null;
  }

  const visibleEntries = displayableEntries.slice(0, visibleCount);
  const hasMore = visibleCount < displayableEntries.length;
  const remaining = displayableEntries.length - visibleCount;

  const handleShowMore = () => {
    setVisibleCount((prev) =>
      Math.min(prev + PAGE_SIZE, displayableEntries.length),
    );
  };

  return (
    <ToggleText>
      <ToggleText.Title>
        View detailed processing log{" "}
        <span className="text-muted-foreground text-sm font-normal">
          ({formatNumber(displayableEntries.length)} entries)
        </span>
      </ToggleText.Title>
      <ToggleText.Content>
        <Col gap={2}>
          <div
            className="overflow-x-auto overflow-y-auto"
            style={{ maxHeight: LOG_TABLE_MAX_HEIGHT }}
            role="region"
            aria-label="Scrollable processing log table"
          >
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b text-left">
                  <th className="py-2 pr-4 font-medium">Comment</th>
                  <th className="py-2 pr-4 font-medium">Step</th>
                  <th className="py-2 pr-4 font-medium">Result</th>
                  <th className="py-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {visibleEntries.map((entry, idx) => (
                  <ProcessingEntryRow
                    key={entry.entryId || idx}
                    entry={entry}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <button
              type="button"
              onClick={handleShowMore}
              aria-label={`Show ${Math.min(PAGE_SIZE, remaining)} more entries`}
              className="text-sm text-muted-foreground underline cursor-pointer hover:text-foreground self-start"
            >
              Show {Math.min(PAGE_SIZE, remaining)} more (
              {formatNumber(remaining)} remaining)
            </button>
          )}
        </Col>
      </ToggleText.Content>
    </ToggleText>
  );
}

interface ProcessingEntryRowProps {
  entry: schema.AuditLogEntry;
}

function ProcessingEntryRow({ entry }: ProcessingEntryRowProps) {
  const stepLabel = STEP_LABELS[entry.step] || entry.step;
  const actionLabel = ACTION_LABELS[entry.action] || entry.action;

  // Truncate preview if too long
  const preview = entry.textPreview
    ? entry.textPreview.length > TEXT_PREVIEW_MAX_LENGTH
      ? entry.textPreview.slice(0, TEXT_PREVIEW_MAX_LENGTH) + "..."
      : entry.textPreview
    : entry.interview || "—";

  return (
    <tr className="border-b border-muted/50 text-muted-foreground">
      <td className="py-2 pr-4" style={{ maxWidth: COMMENT_COLUMN_MAX_WIDTH }}>
        <span className="block truncate" title={entry.textPreview || undefined}>
          {preview}
        </span>
      </td>
      <td className="py-2 pr-4 whitespace-nowrap">{stepLabel}</td>
      <td className="py-2 pr-4 whitespace-nowrap">{actionLabel}</td>
      <td className="py-2 text-xs">{entry.reason || "—"}</td>
    </tr>
  );
}
