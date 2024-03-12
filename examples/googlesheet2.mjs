import fetch from "node-fetch";

// INPUT: https://docs.google.com/spreadsheets/d/1OmPC3j6RNMWPNeZKVPH_ffy6Clouq_Wn_dF_NZ_bVDM/edit#gid=0

async function main() {
  const res = await fetch("http://localhost:8080/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      apiKey: process.env.OPENAI_API_KEY,
      googleSheet: {
        url: "https://docs.google.com/spreadsheets/d/1OmPC3j6RNMWPNeZKVPH_ffy6Clouq_Wn_dF_NZ_bVDM/edit#gid=0",
        pieChartColumns: [
          "Do you support building a Data Availability Layer for Mina?",
          "Please rate how much you agree or disagree with this proposal",
        ],
      },
      title: "Data Availability Layer",
      question: "Do you support building a Data Availability Layer for Mina?",
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
