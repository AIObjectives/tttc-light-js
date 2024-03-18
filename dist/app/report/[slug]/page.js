"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = ReportPage;
var _report = _interopRequireDefault(require("../../../../fixtures/report.json"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function ReportPage({
  params
}) {
  const {
    data
  } = _report.default;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h1", {
    id: "title"
  }, 'json.data.title'), /*#__PURE__*/React.createElement("h1", {
    id: "question"
  }, 'json.data.question'), /*#__PURE__*/React.createElement("div", {
    className: "report-description"
  }, 'json.data.description'));
}