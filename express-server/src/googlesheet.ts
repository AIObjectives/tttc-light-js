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
  const emailToData: { [key: number]: { id: string; comment: string }[] } = {};

  rows.forEach((row, id) => {
    // ! Brandon: indexing into a string and then using that to access a record with key:number ?????????
    // ! Brandon: Adding ts ignores into this so we can use strict mode and not break stuff. This entire file needs redone.
    // @ts-ignore
    emailToData[row[emailColumn]] ??= [];
    // @ts-ignore
    emailToData[row[emailColumn]].push({
      id: String(id),
      comment: commentColumns
        .map(
          ({ name, index }) => `> ${name}\n\n${row[index] || "(not answered)"}`,
        )
        .join("\n\n"),
    });
  });

  let data;
  if (oneSubmissionPerEmail) {
    data = Object.values(emailToData).map((v) => v[v.length - 1]);
  } else {
    data = Object.values(emailToData).flat();
  }

  return { data, pieCharts };
}
