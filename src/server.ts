import express from "express";
import cors from "cors";
import pipeline from "./pipeline";
import html from "./html";
import { Options } from "./types";
import { storeHtml } from "./storage";

const port = 8080;

const app = express();
app.use(cors());
app.use(express.json());

app.post("/generate", async (req, res) => {
  const config: Options = req.body;
  console.log(JSON.stringify(config, null, 2));
  const json = await pipeline(config);
  console.log(JSON.stringify(json, null, 2));
  const htmlString = await html(json);
  if (config.filename) {
    const storeRes = await storeHtml(config.filename, htmlString);
    console.log(storeRes);
  }
  res.send(htmlString);
});

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
