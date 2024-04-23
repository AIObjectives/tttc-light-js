import "dotenv/config";
import express from "express";
import cors from "cors";
// import { checkValidGenerateRequest } from "./middleware";
import { generate } from "./routes/generate";

const port = 8080;

const app = express();

// CHECK ENV VARS
const missingEnvs = [
  "OPENAI_API_KEY",
  "OPENAI_API_KEY_PASSWORD",
  "GCLOUD_STORAGE_BUCKET",
  "GOOGLE_CREDENTIALS_ENCODED",
  "CLIENT_BASE_URL",
].reduce((accum, key) => (process.env[key] ? accum : [...accum, key]), []);
if (missingEnvs.length > 0) {
  throw new Error(`Missing ENVs: ${missingEnvs.map((key) => `${key}, `)}`);
}

// DEV DEFINED MIDDLEWARE
// app.use("/generate",checkValidGenerateRequest)

// EXPRESS PROVIDED MIDDLEWARE
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static("public"));

app.post("/generate", generate);

app.get("/test", async (_, res) => {
  res.send("Success");
});

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
