"use strict";

require("dotenv/config");
var _express = _interopRequireDefault(require("express"));
var _cors = _interopRequireDefault(require("cors"));
var _pipeline = _interopRequireDefault(require("./pipeline"));
var _html = _interopRequireDefault(require("./html"));
var _gpt = require("./gpt");
var _storage = require("./storage");
var _utils = require("./utils");
var _googlesheet = require("./googlesheet");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
const port = 8080;
const app = (0, _express.default)();
app.use((0, _cors.default)());
app.use(_express.default.json({
  limit: "50mb"
}));
app.use(_express.default.static("public"));
app.post("/generate", async (req, res) => {
  let responded = false;
  try {
    const config = req.body;
    if (config.googleSheet) {
      const {
        data,
        pieCharts
      } = await (0, _googlesheet.fetchSpreadsheetData)(config.googleSheet.url, config.googleSheet.pieChartColumns, config.googleSheet.filterEmails, config.googleSheet.oneSubmissionPerEmail);
      config.data = (0, _utils.formatData)(data);
      config.pieCharts = pieCharts;
    }
    throw new Error('test');
    if (!config.data) {
      throw new Error("Missing data");
    }
    config.data = (0, _utils.formatData)(config.data);
    if (config.apiKey === process.env.OPENAI_API_KEY_PASSWORD) {
      // allow users to use our keys if they provided the password
      config.apiKey = process.env.OPENAI_API_KEY;
    }
    if (!config.apiKey) {
      throw new Error("Missing OpenAI API key");
    }
    await (0, _gpt.testGPT)(config.apiKey); // will fail is key is invalid
    config.filename = config.filename || (0, _utils.uniqueSlug)(config.title);
    const url = (0, _storage.getUrl)(config.filename);
    await (0, _storage.storeHtml)(config.filename, (0, _utils.placeholderFile)());
    res.send({
      message: "Request received.",
      filename: config.filename,
      url
      // TODO: send cost estimates...
    });
    responded = true;
    const json = await (0, _pipeline.default)(config);
    const htmlString = await (0, _html.default)(json);
    await (0, _storage.storeHtml)(config.filename, htmlString, true);
    console.log("produced file: " + url);
  } catch (err) {
    console.error(err);
    if (!responded) {
      res.status(500).send({
        error: {
          message: err.message || "An unknown error occurred."
        }
      });
    }
  }
});
app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});