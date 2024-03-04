"use strict";

var _pipeline = _interopRequireDefault(require("./pipeline"));
var _html = _interopRequireDefault(require("./html"));
var _fs = _interopRequireDefault(require("fs"));
var _csvParser = _interopRequireDefault(require("csv-parser"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
const loadSource = () => new Promise(resolve => {
  const results = [];
  _fs.default.createReadStream("./fixtures/source.csv").pipe((0, _csvParser.default)()).on("data", data => results.push(data)).on("end", () => {
    resolve(results);
  });
});
const newCache = () => ({
  get: key => {
    try {
      return JSON.parse(_fs.default.readFileSync(`./fixtures/cache/${key}.json`, "utf-8"));
    } catch (e) {
      return null;
    }
  },
  set: (key, value) => {
    console.log("writing to cache...");
    _fs.default.writeFileSync(`./fixtures/cache/${key}.json`, JSON.stringify(value, null, 2));
  }
});
async function main() {
  const data = await loadSource();
  const json = await (0, _pipeline.default)({
    apiKey: process.env.OPENAI_API_KEY,
    data,
    title: "Heal Michigan",
    question: "What challenges are you and the community facing?",
    description: "This AI-generated report is based on a collection of video interviews about challenges faced by individuals in Michigan, many of whom are formerly incarcerated individuals (referred to below as “returning citizens”). Twelve interviews were conducted in Summer 2023 during a collaboration between the AI Objectives Institute and Silent Cry."
  }, newCache());
  _fs.default.writeFileSync("./fixtures/report.json", JSON.stringify(json, null, 2));
  const report = await (0, _html.default)(json);
  _fs.default.writeFileSync("./fixtures/report.html", report);
  console.log("report written to fixtures/report.html");
  //   const res = await storeHtml("test-report.html", report);
  //   console.log(res);
}
main();