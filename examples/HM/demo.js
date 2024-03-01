import turbo from "../../pipelines/turbo.js";
import fs from "fs";
import csv from "csv-parser";
import * as prettier from "prettier";

const loadSource = () =>
  new Promise((resolve) => {
    const results = [];
    fs.createReadStream("./source.csv")
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => {
        resolve(results);
      });
  });

const newCache = () => ({
  get: (key) => {
    try {
      const res = JSON.parse(fs.readFileSync(`./.cache/${key}.json`));
      console.log("reading from cache...");
      return res;
    } catch (e) {
      return null;
    }
  },
  set: (key, value) => {
    console.log("writing to cache...");
    fs.writeFileSync(`./.cache/${key}.json`, JSON.stringify(value, null, 2));
  },
});

async function main() {
  const data = await loadSource();
  const report = await turbo(
    {
      data,
      title: "Heal Michigan",
      question: "What challenges are you and the community facing?",
      description:
        "This AI-generated report is based on a collection of video interviews about challenges faced by individuals in Michigan, many of whom are formerly incarcerated individuals (referred to below as “returning citizens”). Twelve interviews were conducted in Summer 2023 during a collaboration between the AI Objectives Institute and Silent Cry.",
    },
    newCache()
  );
  fs.writeFileSync(
    "./report.html",
    await prettier.format(report.html, { parser: "html" })
  );
  fs.writeFileSync("./report.json", JSON.stringify(report.json, null, 2));
}

main();
