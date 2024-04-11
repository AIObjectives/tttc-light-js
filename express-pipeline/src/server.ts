import "dotenv/config";
import express from "express";
import cors from "cors";
import pipeline from "./pipeline";
import { Options } from "tttc-common/schema";
import { getStorageUrl, storeJSON } from "./storage";
import { uniqueSlug, formatData } from "./utils";
import { fetchSpreadsheetData } from "./googlesheet";
import { GenerateApiResponse, generateApiReponse } from "tttc-common/api";

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
    // allow users to use our keys if they provided the password
    if (config.apiKey === process.env.OPENAI_API_KEY_PASSWORD) {
      config.apiKey = process.env.OPENAI_API_KEY!;
    } else if (config.apiKey === process.env.ANTHROPIC_API_KEY_PASSWORD) {
      config.apiKey = process.env.ANTHROPIC_API_KEY!;
    }
    if (!config.apiKey) {
      throw new Error("Missing API key");
    }
    const clientBaseUrl = process.env.CLIENT_BASE_URL;
    if (!clientBaseUrl)
      throw new Error("You need a CLIENT_BASE_URL defined in env");
    config.filename = config.filename || uniqueSlug(config.title);
    const jsonUrl = getStorageUrl(config.filename);
    await storeJSON(
      config.filename,
      JSON.stringify({ message: "Your data is being generated" }),
    );
    const reportUrl = new URL(
      `report/${encodeURIComponent(jsonUrl)}`,
      clientBaseUrl,
    ).toString();
    const response: GenerateApiResponse = {
      message: "Request received.",
      filename: config.filename,
      jsonUrl,
      reportUrl,
    };
    res.send(response);
    responded = true;
    const json = await pipeline(config);
    await storeJSON(config.filename, JSON.stringify(json), true);
    console.log("produced file: " + jsonUrl);
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
