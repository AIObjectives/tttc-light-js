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
 */
const CONFIG = {
  reportTitle: "Mina Data Availability Layer [synthetic]",
  reportQuestion: "What do you think about the proposal to create a Data Availability Layer for Mina?",
  googleSheetUrl: "https://docs.google.com/spreadsheets/d/1OmPC3j6RNMWPNeZKVPH_ffy6Clouq_Wn_dF_NZ_bVDM/edit#gid=0",
  pieChartColumns: [
    "Do you support building a Data Availability Layer for Mina?",
    "Please rate how much you agree or disagree with this proposal (1 = Strongly disagree, 5 = Strongly agree)"
  ],
  whitelistCSV: "email-whitelist.csv"
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
