import express from "express";
import cors from "cors";
import pipeline from "./pipeline";
import html from "./html";

const port = 8080;

const app = express();
app.use(cors());
app.use(express.json());

app.post("/generate", async (req, res) => {
  const { data } = req.body;
  const json = await pipeline(data);
  const htmlString = await html(json);
  res.send(htmlString);
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
