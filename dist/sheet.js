"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.fetchSpreadsheetData = fetchSpreadsheetData;
var _axios = _interopRequireDefault(require("axios"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
async function fetchSpreadsheetData(url, pieChartColumnNames = []) {
  // extract the spreadsheet id from the url
  const regex = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
  const matches = url.match(regex);
  if (!matches) throw new Error("Invalid Google Sheets URL");
  const spreadsheetId = matches[1];

  // extract the data from the spreadsheet
  const url2 = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json`;
  const response = await _axios.default.get(url2);
  const jsonStr = response.data.match(/(?<=.*\().*(?=\);)/s)[0];
  const json = JSON.parse(jsonStr);

  // extract the columns and rows
  const columns = json.table.cols.map(x => x.label);
  const rows = json.table.rows.map(x => x.c.map(y => y?.v));

  // identify columns for which pie charts and comments
  let pieChartColumns = [];
  let commentColumns = [];
  columns.forEach((name, index) => {
    if (pieChartColumnNames.includes(name)) {
      pieChartColumns.push({
        name,
        index
      });
    } else if (name !== "Timestamp" && name !== "Email Address") {
      commentColumns.push({
        name,
        index
      });
    }
  });

  // extract the pie chart data
  let pieCharts = pieChartColumns.map(({
    index
  }) => {
    const values = rows.map(row => row[index]);
    const uniqueValues = Array.from(new Set(values));
    return uniqueValues.map(label => ({
      label,
      count: values.filter(x => x === label).length
    }));
  });

  // extract the comments
  const data = rows.map((row, id) => ({
    id: String(id),
    comment: commentColumns.map(({
      name,
      index
    }) => `> ${name}\n\n${row[index] || "(not answered)"}`).join("\n\n")
  }));
  return {
    data,
    pieCharts
  };
}