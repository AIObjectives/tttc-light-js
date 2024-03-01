"use strict";

var _fs = _interopRequireDefault(require("fs"));
var _html = _interopRequireDefault(require("./html"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
const report = JSON.parse(_fs.default.readFileSync("../fixtures/report.json", "utf-8"));
async function main() {
  let str = await (0, _html.default)(report);
  _fs.default.writeFileSync("./newreport.html", str);
}
main();