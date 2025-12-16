#!/usr/bin/env node

import * as fs from "fs-extra";
import * as path from "path";

interface AuditLogEntry {
  entryId: string;
  entryType?: string;
  commentId?: string; // Optional - only for comment entries
  textPreview?: string;
  interview?: string;
  step: string;
  action: string;
  reason?: string;
  timestamp: string;
  commentLength?: number;
}

interface AuditLog {
  version: string;
  reportId: string;
  createdAt: string;
  inputCommentCount: number;
  finalQuoteCount: number;
  modelName: string;
  entries: AuditLogEntry[];
  summary: {
    rejectedBySanitization: number;
    rejectedByMeaningfulness: number;
    rejectedByClaimsExtraction: number;
    deduplicated: number;
    accepted: number;
  };
}

interface SubtopicCrux {
  topic: string;
  subtopic: string;
  cruxClaim: string;
  agree: string[];
  disagree: string[];
}

interface ReportDataV01 {
  title: string;
  description?: string;
}

interface ReportDataV02 {
  title: string;
  description?: string;
  addOns?: {
    subtopicCruxes?: SubtopicCrux[];
  };
}

type ReportData = ReportDataV01 | ReportDataV02;

interface Report {
  data: [string, ReportData];
  auditLog?: AuditLog;
}

interface CSVRow {
  reportTitle: string;
  commentId: string;
  speaker: string;
  commentText: string;
  commentLength: number;
  rejectionStep: string;
  rejectionReason: string;
  timestamp: string;
}

function escapeCSV(value: string | number | undefined): string {
  if (value === undefined || value === null) {
    return "";
  }
  const str = String(value);
  // If contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatStepName(step: string): string {
  switch (step) {
    case "sanitization_filter":
      return "Sanitization Filter";
    case "meaningfulness_filter":
      return "Meaningfulness Filter";
    case "claims_extraction":
      return "Claims Extraction";
    default:
      return step;
  }
}

function sanitizeFilename(title: string): string {
  return title
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function processReport(filePath: string): {
  reportTitle: string;
  rows: CSVRow[];
  stats: {
    inputComments: number;
    finalQuotes: number;
    rejectedBySanitization: number;
    rejectedByMeaningfulness: number;
    rejectedByClaimsExtraction: number;
    accepted: number;
    reportVersion: string;
  };
} {
  console.log(`\nProcessing: ${path.basename(filePath)}`);

  const fileContent = fs.readFileSync(filePath, "utf-8");
  const report: Report = JSON.parse(fileContent);

  if (!report.auditLog) {
    throw new Error(`No audit log found in ${filePath}`);
  }

  const reportVersion = report.data[0];
  const reportData = report.data[1];
  const reportTitle = reportData.title;
  const auditLog = report.auditLog;

  // Calculate actual final output count based on report version
  let actualFinalCount = auditLog.finalQuoteCount;
  if (reportVersion === "v0.2") {
    // For v0.2 reports, count subtopic cruxes if present, otherwise fall back to accepted count
    const v02Data = reportData as ReportDataV02;
    const cruxCount = v02Data.addOns?.subtopicCruxes?.length;
    if (cruxCount !== undefined && cruxCount > 0) {
      actualFinalCount = cruxCount;
    } else {
      // No cruxes - use accepted count from audit log as fallback
      actualFinalCount = auditLog.summary.accepted;
    }
  }

  // Validate audit log schema version
  if (auditLog.version !== "1.0") {
    console.warn(
      `Warning: Audit log version ${auditLog.version} may not be fully supported (expected 1.0)`,
    );
  }

  // Build a lookup map for comment lengths from input entries
  const commentLengthMap = new Map<string, number>();
  auditLog.entries
    .filter(
      (entry) => entry.step === "input" && entry.commentLength !== undefined,
    )
    .forEach((entry) => {
      // Use entryId (always present) or fall back to commentId for backward compat
      const id = entry.entryId || entry.commentId;
      if (id) {
        commentLengthMap.set(id, entry.commentLength!);
      }
    });

  // Filter rejected comment entries (skip non-comment entries like crux validation)
  const rejectedEntries = auditLog.entries.filter(
    (entry) =>
      entry.action === "rejected" &&
      (!entry.entryType || entry.entryType === "comment"),
  );

  // Convert to CSV rows
  const rows: CSVRow[] = rejectedEntries.map((entry) => {
    const id = entry.entryId || entry.commentId || "unknown";
    return {
      reportTitle,
      commentId: id,
      speaker: entry.interview || "",
      commentText: entry.textPreview || "",
      commentLength: commentLengthMap.get(id) || 0,
      rejectionStep: formatStepName(entry.step),
      rejectionReason: entry.reason || "",
      timestamp: entry.timestamp,
    };
  });

  const stats = {
    inputComments: auditLog.inputCommentCount,
    finalQuotes: actualFinalCount,
    rejectedBySanitization: auditLog.summary.rejectedBySanitization,
    rejectedByMeaningfulness: auditLog.summary.rejectedByMeaningfulness,
    rejectedByClaimsExtraction: auditLog.summary.rejectedByClaimsExtraction,
    accepted: auditLog.summary.accepted,
    reportVersion,
  };

  return { reportTitle, rows, stats };
}

function printStats(
  reportTitle: string,
  stats: {
    inputComments: number;
    finalQuotes: number;
    rejectedBySanitization: number;
    rejectedByMeaningfulness: number;
    rejectedByClaimsExtraction: number;
    accepted: number;
    reportVersion: string;
  },
): void {
  const totalRejected =
    stats.rejectedBySanitization +
    stats.rejectedByMeaningfulness +
    stats.rejectedByClaimsExtraction;

  const acceptanceRate = ((stats.accepted / stats.inputComments) * 100).toFixed(
    1,
  );

  console.log(`\n=== ${reportTitle} ===`);
  console.log(`Report Version: ${stats.reportVersion}`);
  console.log(`Total Input Comments: ${stats.inputComments}`);
  console.log(
    `Accepted (passed all filters): ${stats.accepted} (${acceptanceRate}%)`,
  );

  // Show appropriate final output metric based on report version
  if (stats.reportVersion === "v0.2") {
    console.log(`Final Cruxes Generated: ${stats.finalQuotes}`);
  } else {
    console.log(`Final Quote Count: ${stats.finalQuotes}`);
  }

  console.log(`\nTotal Rejected: ${totalRejected}`);
  console.log(
    `  - Sanitization: ${stats.rejectedBySanitization} (${((stats.rejectedBySanitization / stats.inputComments) * 100).toFixed(1)}%)`,
  );
  console.log(
    `  - Meaningfulness: ${stats.rejectedByMeaningfulness} (${((stats.rejectedByMeaningfulness / stats.inputComments) * 100).toFixed(1)}%)`,
  );
  console.log(
    `  - Claims Extraction: ${stats.rejectedByClaimsExtraction} (${((stats.rejectedByClaimsExtraction / stats.inputComments) * 100).toFixed(1)}%)`,
  );
}

function writeCSV(rows: CSVRow[], outputPath: string): void {
  const headers = [
    "Report Title",
    "Comment ID",
    "Speaker/Interview",
    "Comment Text Preview",
    "Comment Length",
    "Rejection Step",
    "Rejection Reason",
    "Timestamp",
  ];

  const csvLines = [
    headers.join(","),
    ...rows.map((row) =>
      [
        escapeCSV(row.reportTitle),
        escapeCSV(row.commentId),
        escapeCSV(row.speaker),
        escapeCSV(row.commentText),
        escapeCSV(row.commentLength),
        escapeCSV(row.rejectionStep),
        escapeCSV(row.rejectionReason),
        escapeCSV(row.timestamp),
      ].join(","),
    ),
  ];

  fs.writeFileSync(outputPath, csvLines.join("\n"), "utf-8");
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error(
      "Usage: pnpm -F utils analyze-audit -- <report-file.json> [...]",
    );
    console.error(
      "\nExample: pnpm -F utils analyze-audit -- ../Community-report.json",
    );
    process.exit(1);
  }

  const allRows: CSVRow[] = [];
  let firstReportTitle = "";

  for (const filePath of args) {
    if (!fs.existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      process.exit(1);
    }

    try {
      const { reportTitle, rows, stats } = processReport(filePath);
      if (!firstReportTitle) firstReportTitle = reportTitle;
      printStats(reportTitle, stats);
      allRows.push(...rows);
    } catch (error) {
      if (error instanceof Error && error.message.includes("No audit log")) {
        console.error(
          `\nError: ${filePath}: Report has no audit log (likely processed before audit logging was implemented)`,
        );
      } else if (error instanceof SyntaxError) {
        console.error(`\nError: ${filePath}: Invalid JSON format`);
      } else {
        console.error(`\nError processing ${filePath}:`, error);
      }
      process.exit(1);
    }
  }

  // Determine output filename
  const outputPath =
    args.length === 1
      ? `rejected-comments-${sanitizeFilename(firstReportTitle)}.csv`
      : `rejected-comments-combined-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;

  writeCSV(allRows, outputPath);
  const absolutePath = path.resolve(outputPath);
  console.log(`\nCSV written to: ${absolutePath}`);
  console.log(`Total rejected comments: ${allRows.length}\n`);
}

main();
