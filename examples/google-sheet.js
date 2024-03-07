/* Instructions: 

To run TttC on the results of a Google Form, you need to:

- open your form, click on the responses tab, and create a new spreadsheet
- open the spreadsheet, go to File > Share > Publish to the web
- and select the sheet with form responses and choose CSV format

We'll use the following as examples:

Form: https://docs.google.com/forms/d/16uQcBhT1bZhUHmF1gnISMsMawgX8oABCMsxhZU_3j_0/edit#responses
Sheet results: https://docs.google.com/spreadsheets/d/1VjvVe8L_Y86dBBt8ptY3p37rf1joC-wfYGVIgDVP0TE/edit?resourcekey#gid=968078847
Publised csv: https://docs.google.com/spreadsheets/d/e/2PACX-1vTVpxZP15DnsVz9r3hfNI5AbgMTQJIlXklswlCJn3RZBpCGjFVqD1jWTpC14ES3eldBZVVpO6sWrgGW/pub?gid=968078847&single=true&output=csv
*/

const axios = require("axios");
const { parse } = require("csv-parse/sync");
const csvUrl =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTVpxZP15DnsVz9r3hfNI5AbgMTQJIlXklswlCJn3RZBpCGjFVqD1jWTpC14ES3eldBZVVpO6sWrgGW/pub?gid=968078847&single=true&output=csv";

async function main() {
  try {
    const csvResponse = await axios.get(csvUrl);
    const data = parse(csvResponse.data).map((record, id) => ({
      id,
      comment: `Vote: ${record[1]}. Explanation: ${record[2]}`,
    }));
    const config = {
      apiKey: process.env.OPENAI_API_KEY,
      data,
      title: "Block Size",
      question: "How would you change the block size?",
      clusteringInstructions: `
          Use three top-level topics distinguishing the
          arguments to increase / decrease / keep the block size.
      `,
    };
    const res = await axios.post("http://localhost:8080/generate", config);
    const { url } = res.data;
    console.log("Report generated at: ", url);
  } catch (e) {
    console.error(e);
  }
}

main();
