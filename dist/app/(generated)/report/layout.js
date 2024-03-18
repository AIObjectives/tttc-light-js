"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = RootLayout;
exports.metadata = void 0;
require("./reportPage.css");
const metadata = exports.metadata = {
  title: 'Talk the City'
};
function RootLayout({
  children
}) {
  return /*#__PURE__*/React.createElement("html", {
    lang: "en"
  }, /*#__PURE__*/React.createElement("body", null, children));
}