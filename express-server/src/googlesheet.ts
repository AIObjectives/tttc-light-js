import axios from "axios";
import { LLMPieChart, SourceRow } from "tttc-common/schema";

export async function fetchSpreadsheetData(
  url: string,
  pieChartColumnNames: string[] = [],
  filterEmails?: string[],
  oneSubmissionPerEmail?: boolean,
): Promise<{ data: SourceRow[]; pieCharts: LLMPieChart[] }> {
  // extract the spreadsheet id from the url
  const regex = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
  const matches = url.match(regex);
  if (!matches) throw new Error("Invalid Google Sheets URL");
  const spreadsheetId = matches[1];

  // extract the data from the spreadsheet
  const url2 = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json`;
  const response = await axios.get(url2);
  const match = response.data.match(/.*\(([\s\S]*)\);/);
  const jsonStr = match ? match[1] : null;
  const json = JSON.parse(jsonStr);

  // extract the columns and rows
  const columns: string[] = json.table.cols.map((x: any) => x.label);
  let rows: string[] = json.table.rows.map((x: any) =>
    x.c.map((y: any) => y?.v),
  );

  const emailColumn = columns.indexOf("Email Address");

  // filter out rows with forbidden email addresses
  if (filterEmails) {
    rows = rows.filter((row) => {
      const email = row[emailColumn];
      return filterEmails.includes(email);
    });
  }

  // identify columns for which pie charts and comments
  let pieChartColumns: { name: string; index: number }[] = [];
  let commentColumns: { name: string; index: number }[] = [];
  columns.forEach((name: string, index: number) => {
    if (pieChartColumnNames.includes(name)) {
      pieChartColumns.push({ name, index });
    } else if (name !== "Timestamp" && name !== "Email Address") {
      commentColumns.push({ name, index });
    }
  });

  // extract the pie chart data
  let pieCharts = pieChartColumns.map(({ name, index }) => {
    const values = rows.map((row) => row[index]);
    const uniqueValues = Array.from(new Set(values));
    return {
      title: name,
      items: uniqueValues.map((label) => ({
        label,
        count: values.filter((x) => x === label).length,
      })),
    };
  });

  // extract the comments
  // Group data by email address (string keys)
  const emailToData: Record<
    string,
    Array<{ id: string; comment: string }>
  > = {};

  rows.forEach((row, id) => {
    const email = String(row[emailColumn]);
    emailToData[email] ??= [];
    emailToData[email].push({
      id: String(id),
      comment: commentColumns
        .map(
          ({ name, index }) => `> ${name}\n\n${row[index] || "(not answered)"}`,
        )
        .join("\n\n"),
    });
  });

  // Convert grouped data to SourceRow[] with validation
  const validateSourceRow = (row: {
    id: string;
    comment: string;
  }): SourceRow => {
    // Runtime validation: ensure required fields are present and non-empty
    if (!row.id || typeof row.id !== "string") {
      throw new Error(
        "Invalid Google Sheets data: missing or invalid id field",
      );
    }
    if (!row.comment || typeof row.comment !== "string") {
      throw new Error(
        "Invalid Google Sheets data: missing or invalid comment field",
      );
    }
    // Return as SourceRow after validation
    return row as SourceRow;
  };

  let data: SourceRow[];
  if (oneSubmissionPerEmail) {
    // Take only the last submission per email
    data = Object.values(emailToData).map((submissions) => {
      const lastSubmission = submissions[submissions.length - 1];
      return validateSourceRow(lastSubmission);
    });
  } else {
    // Include all submissions
    data = Object.values(emailToData).flat().map(validateSourceRow);
  }

  return { data, pieCharts };
}
