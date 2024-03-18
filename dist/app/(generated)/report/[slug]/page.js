"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = ReportPage;
var _report = _interopRequireDefault(require("../../../../../fixtures/report.json"));
var _report2 = _interopRequireDefault(require("src/features/report"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function ReportPage({
  params
}) {
  const {
    data
  } = _report.default;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(_report2.default, {
    data: _report.default
  }));
}