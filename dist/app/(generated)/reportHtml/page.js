"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = TempPage;
var _report = _interopRequireDefault(require("src/features/report"));
var _report2 = _interopRequireDefault(require("../../../../fixtures/report.json"));
var _server = _interopRequireDefault(require("react-dom/server"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
const html = _server.default.renderToString( /*#__PURE__*/React.createElement(_report.default, {
  data: _report2.default
}));
function TempPage({
  params
}) {
  return `
        ${html}
        `;
}