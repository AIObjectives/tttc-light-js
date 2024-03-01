import fs from "fs";
import html from "./html";
import React from "react";
import ReactDOMServer from "react-dom/server";
import * as prettier from "prettier";

const report = JSON.parse(fs.readFileSync("../fixtures/report.json", "utf-8"));

async function main() {
  let str = await html(report);
  fs.writeFileSync("./newreport.html", str);
}

main();
