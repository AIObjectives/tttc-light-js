import fetch from "node-fetch";
import fs from "fs";
import { parse } from "csv-parse/sync";

/*
 * Report generation options:
 * reportTitle (string): The title of this report.
 * reportQuestion (string): The overall topic of this report's content
 * googleSheetUrl (string): full URL for a Google Sheets spreadsheet. The data
 *     to analyze must be in the first tab of this sheet.
 * pieChartColumns (string|null): a list of column names in the spreadsheet to
 *     treat as quantitative data, displayed as pie charts at the beginning of
 *     the report. Values must match the spreadsheet column names exactly.
 * whitelistCSV (string|null): the name of a CSV in the current directory listing
 *     email addresses to include responses from, if desired.
 *
 * Note: in any single column, all cells must have the same data type (string or
 * number format) for the Google Sheets API to fetch them as displayed.
 */
const CONFIG = {
  reportTitle: "Talk to the City [synethic survey]",
  reportQuestion: "What are your impressions of Talk to the City?",
  googleSheetUrl: "https://docs.google.com/spreadsheets/d/1pQjnqA4Ul07JCRDr0UMuOP26z3QD0RfigTa6zuOUBmw/edit#gid=0",
  pieChartColumns: [
    "Would you use the tool described in the article? (1 = Very unlikely to use; 5 = Very likely to use)",
    "How helpful would you expect this tool to be for your work? (1 = Not helpful; 5 = Very helpful)"
  ],
  whitelistCSV: "example-email-whitelist.csv"
}


function unpackCSV(filename) {
  const content = fs.readFileSync(filename);
  let records = parse(content, {
    columns: false,
    skip_empty_lines: true,
    relax_quotes: true
  });
  records = records.flat().filter(item => item !== '');
  return records;
}

async function main() {
  let whitelist = null;
  if (CONFIG.whitelistCSV) {
    whitelist = unpackCSV(CONFIG.whitelistCSV);
    console.log('Including only responses from emails in ' + CONFIG.whitelistCSV);
  }

  const res = await fetch("http://localhost:8080/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      apiKey: process.env.OPENAI_API_KEY,
      googleSheet: {
        url: CONFIG.googleSheetUrl,
        pieChartColumns: CONFIG.pieChartColumns,
        filterEmails: CONFIG.emailwhitelist
      },
      title: CONFIG.reportTitle,
      question: CONFIG.reportQuestion
    }),
  });
  const resData = await res.json();
  console.log("The report will be generated at: ", resData.url);
}

try {
  main();
} catch (e) {
  console.error(e.message);
}
