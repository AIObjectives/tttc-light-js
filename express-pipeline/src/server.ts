import "dotenv/config";
import express from "express";
import cors from "cors";
import generate from "./routes/generate";
import create from "./routes/create";
import { validateEnv } from "./types/context";
import { contextMiddleware } from "./middleware";

const port = process.env.PORT || 8080;

const env = validateEnv();

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static("public"));
app.use(contextMiddleware(env));

/**
 * Depcrecated route
 */
app.post("/generate", generate);

/**
 * Creates report
 */
app.post("/create", create);

app.get("/test", async (req, res) => {
  res.send("Success");
});

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
