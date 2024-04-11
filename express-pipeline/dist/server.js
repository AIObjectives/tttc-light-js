"use strict";

require("dotenv/config");
var _express = _interopRequireDefault(require("express"));
var _cors = _interopRequireDefault(require("cors"));
var _pipeline = _interopRequireDefault(require("./pipeline"));
var _storage = require("./storage");
var _utils = require("./utils");
var _googlesheet = require("./googlesheet");
function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}
const port = 8080;
const app = (0, _express.default)();
app.use((0, _cors.default)());
app.use(
  _express.default.json({
    limit: "50mb",
  }),
);
app.use(_express.default.static("public"));
app.post("/generate", async (req, res) => {
  let responded = false;
  try {
    const config = req.body;
    if (config.googleSheet) {
      const { data, pieCharts } = await (0, _googlesheet.fetchSpreadsheetData)(
        config.googleSheet.url,
        config.googleSheet.pieChartColumns,
        config.googleSheet.filterEmails,
        config.googleSheet.oneSubmissionPerEmail,
      );
      config.data = (0, _utils.formatData)(data);
      config.pieCharts = pieCharts;
    }
    if (!config.data) {
      throw new Error("Missing data");
    }
    config.data = (0, _utils.formatData)(config.data);
    // allow users to use our keys if they provided the password
    if (config.apiKey === process.env.OPENAI_API_KEY_PASSWORD) {
      config.apiKey = process.env.OPENAI_API_KEY;
    } else if (config.apiKey === process.env.ANTHROPIC_API_KEY_PASSWORD) {
      config.apiKey = process.env.ANTHROPIC_API_KEY;
    }
    if (!config.apiKey) {
      throw new Error("Missing API key");
    }
    const clientBaseUrl = process.env.CLIENT_BASE_URL;
    if (!clientBaseUrl)
      throw new Error("You need a CLIENT_BASE_URL defined in env");
    config.filename = config.filename || (0, _utils.uniqueSlug)(config.title);
    const jsonUrl = (0, _storage.getStorageUrl)(config.filename);
    await (0, _storage.storeJSON)(
      config.filename,
      JSON.stringify({
        message: "Your data is being generated",
      }),
    );
    const reportUrl = new URL(
      `report/${encodeURIComponent(jsonUrl)}`,
      clientBaseUrl,
    ).toString();
    const response = {
      message: "Request received.",
      filename: config.filename,
      jsonUrl,
      reportUrl,
    };
    console.log("response", response);
    console.log("did parsing");
    res.send(response);
    responded = true;
    const json = await (0, _pipeline.default)(config);
    console.log("json", json);
    await (0, _storage.storeJSON)(config.filename, JSON.stringify(json), true);
    console.log("produced file: " + jsonUrl);
  } catch (err) {
    console.error(err);
    if (!responded) {
      res.status(500).send({
        error: {
          message: err.message || "An unknown error occurred.",
        },
      });
    }
  }
});
app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
