import "dotenv/config";
import fetch from "node-fetch";

// SEE OUTPUT: https://storage.googleapis.com/test-gds-api/fruit-preference-1710194611555

async function main() {
  const res = await fetch("http://localhost:8080/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      apiKey: process.env.OPENAI_API_KEY,
      googleSheet: {
        url: "https://docs.google.com/spreadsheets/d/1U3zQcWV-cWp2l-iW5CK6NJj4NqXATwR9scwwhYWt9zA/edit?resourcekey#gid=1675168815",
        pieChartColumns: ["What do you prefer?", "What size?"],
        filterEmails: [
          "bruno1@gmail.com",
          "ted@gmail.com",
          "alice@gmail.com",
          "bob@gmail.com",
          "yannis@gmail.com",
        ],
      },
      title: "Fruit Preference",
      question: "Do you prefer apples or oranges?",
    }),
  });
  const resData = await res.json();
  console.log("The report will be generated at: ", resData.reportUrl);
}

try {
  main();
} catch (e) {
  console.error(e.message);
}
