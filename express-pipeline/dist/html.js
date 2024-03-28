"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true,
});
exports.generateServerSideHTML = void 0;
var prettier = _interopRequireWildcard(require("prettier"));
var _Report = _interopRequireDefault(require("./Report"));
var _styles = _interopRequireDefault(require("./styles"));
function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}
function _getRequireWildcardCache(e) {
  if ("function" != typeof WeakMap) return null;
  var r = new WeakMap(),
    t = new WeakMap();
  return (_getRequireWildcardCache = function (e) {
    return e ? t : r;
  })(e);
}
function _interopRequireWildcard(e, r) {
  if (!r && e && e.__esModule) return e;
  if (null === e || ("object" != typeof e && "function" != typeof e))
    return { default: e };
  var t = _getRequireWildcardCache(r);
  if (t && t.has(e)) return t.get(e);
  var n = { __proto__: null },
    a = Object.defineProperty && Object.getOwnPropertyDescriptor;
  for (var u in e)
    if ("default" !== u && {}.hasOwnProperty.call(e, u)) {
      var i = a ? Object.getOwnPropertyDescriptor(e, u) : null;
      i && (i.get || i.set) ? Object.defineProperty(n, u, i) : (n[u] = e[u]);
    }
  return (n.default = e), t && t.set(e, n), n;
}
// ! TODO styles
const wrapHtml = (htmlStr) => {
  return `<!DOCTYPE html>
    <html>
    <head>
        <title>Report</title>
        <style>
            ${_styles.default}
        </style>
    </head>
    <body>
        ${htmlStr}
        <script>
            // Inline JS or link to external JS
        </script>
    </body>
    </html>`;
};
const generateServerSideHTML = async (json) => {
  // TODO: Previously had to do dynamic import. See if we skip that later.
  const ReactDOMServer = (await import("react-dom/server")).default;
  const html = ReactDOMServer.renderToString(
    (0, _Report.default)({
      data: json,
    }),
  );
  const parsedHtml = wrapHtml(html).replace(/data-onclick/g, "onclick");
  return await prettier.format(parsedHtml, {
    parser: "html",
  });
};
exports.generateServerSideHTML = generateServerSideHTML;
