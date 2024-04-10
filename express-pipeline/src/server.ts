import "dotenv/config";
import express from "express";
import cors from "cors";
import pipeline from "./pipeline";
import { Options, options } from "tttc-common/schema";
import { getUrl, storeJSON } from "./storage";
import { uniqueSlug, formatData } from "./utils";
import { fetchSpreadsheetData } from "./googlesheet";

const port = 8080;

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static("public"));

app.post("/generate", async (req, res) => {
  let responded = false;
  try {
    console.log("started");
    const config: Options = req.body;
    if (config.googleSheet) {
      const { data, pieCharts } = await fetchSpreadsheetData(
        config.googleSheet.url,
        config.googleSheet.pieChartColumns,
        config.googleSheet.filterEmails,
        config.googleSheet.oneSubmissionPerEmail,
      );
      config.data = formatData(data);
      config.pieCharts = pieCharts;
    }
    if (!config.data) {
      throw new Error("Missing data");
    }
    console.log(1);
    config.data = formatData(config.data);
    console.log(2);
    // allow users to use our keys if they provided the password
    if (config.apiKey === process.env.OPENAI_API_KEY_PASSWORD) {
      config.apiKey = process.env.OPENAI_API_KEY!;
    } else if (config.apiKey === process.env.ANTHROPIC_API_KEY_PASSWORD) {
      config.apiKey = process.env.ANTHROPIC_API_KEY!;
    }
    console.log(3);
    if (!config.apiKey) {
      throw new Error("Missing API key");
    }
    config.filename = config.filename || uniqueSlug(config.title);
    console.log(4);
    const url = getUrl(config.filename);
    console.log(5);
    await storeJSON(
      config.filename,
      JSON.stringify({ message: "Your data is being generated" }),
    );
    console.log(6);
    res.send({
      message: "Request received.",
      filename: config.filename,
      url,
      // TODO: send cost estimates...
    });
    responded = true;
    const json = await pipeline(config);
    console.log("json", json);
    await storeJSON(config.filename, JSON.stringify(json), true);
    console.log("produced file: " + url);
  } catch (err: any) {
    console.error(err);
    if (!responded) {
      res.status(500).send({
        error: { message: err.message || "An unknown error occurred." },
      });
    }
  }
});

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
