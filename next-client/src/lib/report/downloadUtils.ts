/**
 * Utility functions for downloading report data
 */

import * as schema from "tttc-common/schema";

/**
 * Downloads report data as a JSON file directly from UIReportData
 * @param reportData The report data to download
 * @param filename Base filename (without extension)
 */
export function downloadReportData(
  reportData: schema.UIReportData,
  filename: string,
): void {
  try {
    // Create the downloadable report format
    const downloadableReport: schema.DownloadDataReportSchema = [
      "v0.2",
      {
        data: ["v0.2", reportData],
        downloadTimestamp: Date.now(),
      },
    ];

    // Convert to JSON and create blob
    const jsonString = JSON.stringify(downloadableReport, null, 2);
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
