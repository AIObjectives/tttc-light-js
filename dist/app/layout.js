"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = RootLayout;
exports.metadata = void 0;
const metadata = exports.metadata = {
  title: 'Talk the City'
};
function RootLayout({
  children
}) {
  return /*#__PURE__*/React.createElement("html", {
    lang: "en"
  }, /*#__PURE__*/React.createElement("head", null, /*#__PURE__*/React.createElement("script", {
    src: "https://unpkg.com/papaparse@latest/papaparse.min.js"
  }), /*#__PURE__*/React.createElement("link", {
    rel: "stylesheet",
    href: "style.css"
  })), /*#__PURE__*/React.createElement("body", null, /*#__PURE__*/React.createElement("script", {
    src: "index.js"
  }), /*#__PURE__*/React.createElement("div", {
    className: "navbar"
  }, /*#__PURE__*/React.createElement("a", {
    href: "/"
  }, /*#__PURE__*/React.createElement("h1", null, "Talk to the City (Next)")), /*#__PURE__*/React.createElement("div", {
    className: "nav-links"
  }, /*#__PURE__*/React.createElement("a", {
    href: "/examples.html"
  }, "Examples"), /*#__PURE__*/React.createElement("a", {
    href: "https://github.com/AIObjectives/tttc-light-js?tab=readme-ov-file#api-docs"
  }, "API docs"))), children));
}