import axios from "axios";
import { SourceRow, PieChart } from "./types";

export async function fetchSpreadsheetData(
  url: string,
  pieChartColumnNames: string[] = [],
  filterEmails?: string[],
  oneSubmissionPerEmail?: boolean
): Promise<{ data: SourceRow[]; pieCharts: PieChart[] }> {
  // extract the spreadsheet id from the url
  const regex = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
  const matches = url.match(regex);
  if (!matches) throw new Error("Invalid Google Sheets URL");
  const spreadsheetId = matches[1];

  // extract the data from the spreadsheet
  const url2 = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json`;
  const response = await axios.get(url2);
  const jsonStr = response.data.match(/(?<=.*\().*(?=\);)/s)[0];
  const json = JSON.parse(jsonStr);

  // extract the columns and rows
  const columns: string[] = json.table.cols.map((x: any) => x.label);
  let rows: string[] = json.table.rows.map((x: any) =>
    x.c.map((y: any) => y?.v)
  );

  const emailColumn = columns.indexOf("Email Address")

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
  const emailToData = {};

  rows.forEach((row, id) => {
    emailToData[row[emailColumn]] ??= [];
    emailToData[row[emailColumn]].push({
      id: String(id),
      comment: commentColumns
        .map(
          ({ name, index }) => `> ${name}\n\n${row[index] || "(not answered)"}`
        )
        .join("\n\n"),
    });
  });

  let data;
  if (oneSubmissionPerEmail) {
    data = Object.values(emailToData).map((v) => v[v.length-1])
  } else {
    data = Object.values(emailToData).flat();
  }

  return { data, pieCharts };
}
