import 'dotenv/config'
import express from "express";
import cors from "cors";
import pipeline from "./pipeline";
import html from "./html";
import { testGPT } from "./gpt";
import { Options } from "./types";
import { getUrl, storeHtml } from "./storage";
import { uniqueSlug, formatData, placeholderFile } from "./utils";
import { fetchSpreadsheetData } from "./googlesheet";

const port = 8080;

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static("public"));

app.post("/generate", async (req, res) => {
  let responded = false;
  try {
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
    config.data = formatData(config.data);
    if (config.apiKey === process.env.OPENAI_API_KEY_PASSWORD) {
      // allow users to use our keys if they provided the password
      config.apiKey = process.env.OPENAI_API_KEY!;
    }
    if (!config.apiKey) {
      throw new Error("Missing OpenAI API key");
    }
    await testGPT(config.apiKey); // will fail is key is invalid
    config.filename = config.filename || uniqueSlug(config.title);
    const url = getUrl(config.filename);
    await storeHtml(config.filename, placeholderFile());
    res.send({
      message: "Request received.",
      filename: config.filename,
      url,
      // TODO: send cost estimates...
    });
    responded = true;
    const json = await pipeline(config);
    const htmlString = await html(json);
    await storeHtml(config.filename, htmlString, true);
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
