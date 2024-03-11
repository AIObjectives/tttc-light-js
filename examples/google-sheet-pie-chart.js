/* Instructions: 

To run TttC on the results of a Google Form, you need to:

- open your form, click on the responses tab, and create a new spreadsheet
- open the spreadsheet, go to File > Share > Publish to the web
- and select the sheet with form responses and choose CSV format

We'll use the following as examples:

Form: https://docs.google.com/forms/d/1LxYqPkq32yfHLExwz_l7PwuehaHtiWONqBfTRXqUb1k/edit
Answer link: https://forms.gle/hBYiR814Cq49RMnw8 
Sheet results: https://docs.google.com/spreadsheets/d/1U3zQcWV-cWp2l-iW5CK6NJj4NqXATwR9scwwhYWt9zA/edit?resourcekey#gid=1675168815
Publised csv: https://docs.google.com/spreadsheets/d/e/2PACX-1vSwbsbvYoXAiNEACa2AbzLDUNhmo6S4z_WPaNyl6TDXqoy79v24EbyKHhySImWIL04k-eA3tMNM2JSy/pub?gid=1675168815&single=true&output=csv

OUTPUT: https://storage.googleapis.com/test-gds-api/fruit-preference-1710180725407

*/

const axios = require("axios");
const { parse } = require("csv-parse/sync");
const csvUrl =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSwbsbvYoXAiNEACa2AbzLDUNhmo6S4z_WPaNyl6TDXqoy79v24EbyKHhySImWIL04k-eA3tMNM2JSy/pub?gid=1675168815&single=true&output=csv";

const allowedUsers = [
  "bruno1@gmail.com",
  "ted@gmail.com",
  "alice@gmail.com",
  "bob@gmail.com",
  "yannis@gmail.com",
];

async function main() {
  try {
    const csvResponse = await axios.get(csvUrl);
    const counts = {};
    const data = parse(csvResponse.data)
      .filter((record) => allowedUsers.includes(record[1]))
      .map((record, id) => {
        console.log(record);
        let comment = `Vote: ${record[2]}.`;
        if (record[3].trim().length)
          comment += ` I like Apples, because... ${record[3]}`;
        if (record[4].trim().length)
          comment += ` I like Oranges, because... ${record[4]}`;
        counts[record[2]] = (counts[record[2]] || 0) + 1;
        return { id, comment };
      });
    const pieChart = [
      { label: "Apples", count: counts["Apples"] },
      { label: "Oranges", count: counts["Oranges"] },
    ];
    const config = {
      apiKey: process.env.OPENAI_API_KEY,
      data,
      pieChart,
      title: "Fruit Preference",
      question: "Do you prefer apples or oranges?",
      clusteringInstructions: `
          Use two top-level topics distinguishing the
          arguments for apple vs for oranges.
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
