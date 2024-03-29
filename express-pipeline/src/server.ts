import express from "express";
import cors from "cors";
import pipeline from "./pipeline";
import { generateServerSideHTML } from "./html";
import { testGPT } from "./gpt";
import { Options, options } from "tttc-common/schema";
import { getUrl, storeHtml } from "./storage";
import { uniqueSlug, formatData, placeholderFile } from "./utils";
import json from "tttc-common/fixtures/report.json";
import { GenerateApiResponse } from "tttc-common/api";

require("dotenv").config();

const port = 8080;

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static("public"));

app.post("/generate", async (req, res) => {
  let responded = false;
  try {
    const config: Options = options.parse(req.body);
    if (!config.data) {
      res.status(500).send({ error: "Missing data" });
    }
    config.data = formatData(config.data);
    if (config.apiKey === process.env.OPENAI_API_KEY_PASSWORD) {
      // allow users to use our keys if they provided the password
      config.apiKey = process.env.OPENAI_API_KEY!;
    }

    if (!config.apiKey) {
      return res.status(500).send({ error: "missing key" });
    }
    await testGPT(config.apiKey); // will fail is key is invalid
    config.filename = config.filename || uniqueSlug(config.title);
    const url = getUrl(config.filename);
    await storeHtml(config.filename, placeholderFile());
    const response: GenerateApiResponse = {
      message: "Request received.",
      filename: config.filename,
      url,
      // TODO: send cost estimates...
    };
    res.send(response);
    responded = true;
    const json = await pipeline(config);
    const htmlString = await generateServerSideHTML(json);
    await storeHtml(config.filename, htmlString, true);
    console.log("produced file: " + url);
  } catch (err: any) {
    console.error(err);
    if (!responded) {
      res.status(500).send({
        error: err.message || "An unknown error occurred.",
      });
    }
  }
});

app.get("/test", async (req, res) => {
  const htmlString = await generateServerSideHTML(json);
  res.send(htmlString);
});

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
