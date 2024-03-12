import pipeline from "./pipeline";
import html from "./html";
import fs from "fs";
import csv from "csv-parser";
import { SourceRow, Cache } from "./types";

const loadSource = (): Promise<SourceRow[]> =>
  new Promise((resolve) => {
    const results: SourceRow[] = [];
    fs.createReadStream("./fixtures/source.csv")
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => {
        resolve(results);
      });
  });

const newCache = (): Cache => ({
  get: (key) => {
    try {
      return JSON.parse(
        fs.readFileSync(`./fixtures/cache/${key}.json`, "utf-8")
      );
    } catch (e) {
      return null;
    }
  },
  set: (key, value) => {
    console.log("writing to cache...");
    fs.writeFileSync(
      `./fixtures/cache/${key}.json`,
      JSON.stringify(value, null, 2)
    );
  },
});

async function main() {
  const data = await loadSource();
  const json = await pipeline(
    {
      apiKey: process.env.OPENAI_API_KEY!,
      data,
      pieCharts: [
        {
          title: "",
          items: [
            { label: "Challenges", count: 10 },
            { label: "Opportunities", count: 5 },
          ],
        },
      ],
      title: "Heal Michigan",
      question: "What challenges are you and the community facing?",
      description:
        "This AI-generated report is based on a collection of video interviews about challenges faced by individuals in Michigan, many of whom are formerly incarcerated individuals (referred to below as “returning citizens”). Twelve interviews were conducted in Summer 2023 during a collaboration between the AI Objectives Institute and Silent Cry.",
    },
    newCache()
  );
  fs.writeFileSync("./fixtures/report.json", JSON.stringify(json, null, 2));
  const report = await html(json);
  fs.writeFileSync("./fixtures/report.html", report);
  console.log("report written to fixtures/report.html");
}

main();
