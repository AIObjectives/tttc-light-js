/**
 * Utility functions for downloading report data
 */

import type * as schema from "tttc-common/schema";

/**
 * Downloads report data from in-memory PipelineOutput
 * This preserves the complete PipelineOutput including auditLog, metadata, etc.
 *
 * @param pipelineOutput The complete pipeline output object
 * @param filename Base filename (without extension)
 */
export function downloadReportData(
  pipelineOutput: schema.PipelineOutput,
  filename: string,
): void {
  try {
    // Convert to JSON string with formatting
    const jsonString = JSON.stringify(pipelineOutput, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const downloadUrl = window.URL.createObjectURL(blob);

    // Create and trigger download
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `${filename}-${Date.now()}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    throw new Error(
      `Failed to download report data: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
