"use strict";

var _express = _interopRequireDefault(require("express"));
var _cors = _interopRequireDefault(require("cors"));
var _pipeline = _interopRequireDefault(require("./pipeline"));
var _html = _interopRequireDefault(require("./html"));
var _storage = require("./storage");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
const port = 8080;
const app = (0, _express.default)();
app.use((0, _cors.default)());
app.use(_express.default.json());
app.post("/generate", async (req, res) => {
  const config = req.body;
  console.log(JSON.stringify(config, null, 2));
  const json = await (0, _pipeline.default)(config);
  console.log(JSON.stringify(json, null, 2));
  const htmlString = await (0, _html.default)(json);
  if (config.filename) {
    const storeRes = await (0, _storage.storeHtml)(config.filename, htmlString);
    console.log(storeRes);
  }
  res.send(htmlString);
});
app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});