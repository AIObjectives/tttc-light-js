"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.Report = void 0;
var _react = _interopRequireDefault(require("react"));
var _styles = _interopRequireDefault(require("./styles"));
var _server = _interopRequireDefault(require("react-dom/server"));
var prettier = _interopRequireWildcard(require("prettier"));
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
const Report = ({
  data
}) => {
  const sourceMap = {};
  data.data.forEach(d => {
    sourceMap[d.id] = d;
  });
  const onclick = claim => {
    let callback = `document.getElementById('${claim.claimId}').classList.toggle('open');`;
    const {
      video,
      timestamp
    } = sourceMap[claim.commentId];
    if (video) {
      const parts = video.split("/");
      const videoId = parts[parts.length - 1];
      let [hours, minutes, seconds] = timestamp.split(":").map(Number);
      let totalSeconds = hours * 3600 + minutes * 60 + seconds;
      const src = `https://player.vimeo.com/video/${videoId}#t=${totalSeconds}s`;
      callback += `document.getElementById('video-${claim.claimId}').src = '${src}';`;
    }
    return callback;
  };
  return /*#__PURE__*/_react.default.createElement("html", null, /*#__PURE__*/_react.default.createElement("head", null, /*#__PURE__*/_react.default.createElement("style", null, _styles.default)), /*#__PURE__*/_react.default.createElement("body", null, /*#__PURE__*/_react.default.createElement("h1", {
    id: "title"
  }, data.title), /*#__PURE__*/_react.default.createElement("h1", {
    id: "question"
  }, data.question), /*#__PURE__*/_react.default.createElement("div", {
    className: "report-description"
  }, data.description), data.tree.map(topic => /*#__PURE__*/_react.default.createElement("div", {
    key: topic.topicId
  }, /*#__PURE__*/_react.default.createElement("h2", null, topic.topicName, " ", /*#__PURE__*/_react.default.createElement("span", {
    className: "count"
  }, "(", topic.claimsCount, ")")), /*#__PURE__*/_react.default.createElement("div", {
    className: "topic-description"
  }, topic.topicShortDescription), topic.subtopics.map(subtopic => /*#__PURE__*/_react.default.createElement("div", {
    key: subtopic.subtopicId,
    className: "subtopic",
    id: subtopic.subtopicId
  }, /*#__PURE__*/_react.default.createElement("h3", null, subtopic.subtopicName, " ", /*#__PURE__*/_react.default.createElement("span", {
    className: "count"
  }, "(", subtopic.claims.length, ")")), /*#__PURE__*/_react.default.createElement("div", {
    className: "subtopic-description"
  }, subtopic.subtopicShortDescription), /*#__PURE__*/_react.default.createElement("ul", null, subtopic.claims.map(claim => /*#__PURE__*/_react.default.createElement("li", {
    key: claim.claimId,
    id: claim.claimId
  }, /*#__PURE__*/_react.default.createElement("span", {
    className: "claim",
    "data-onclick": onclick(claim)
  }, claim.claim, " ", claim.duplicates ? ` (x${1 + claim.duplicates.length})` : ""), /*#__PURE__*/_react.default.createElement("div", {
    className: "details",
    id: `details-${claim.claimId}`
  }, sourceMap[claim.commentId].interview && /*#__PURE__*/_react.default.createElement(_react.default.Fragment, null, "Interview:", " ", /*#__PURE__*/_react.default.createElement("span", {
    className: "interview"
  }, "\"", sourceMap[claim.commentId].interview, "\""), " ", /*#__PURE__*/_react.default.createElement("br", null)), sourceMap[claim.commentId].video && /*#__PURE__*/_react.default.createElement("iframe", {
    id: `video-${claim.claimId}`,
    className: "video",
    src: "",
    width: "250",
    height: "141",
    allow: "autoplay; fullscreen; picture-in-picture"
  }), /*#__PURE__*/_react.default.createElement("br", null), "Quote: ", /*#__PURE__*/_react.default.createElement("span", {
    className: "quote"
  }, "\"", claim.quote, "\""), claim.duplicates && /*#__PURE__*/_react.default.createElement("div", null, /*#__PURE__*/_react.default.createElement("div", null, "Similar claims:"), /*#__PURE__*/_react.default.createElement("ul", null, claim.duplicates.map(duplicate => /*#__PURE__*/_react.default.createElement("li", {
    key: duplicate.claimId,
    id: duplicate.claimId
  }, /*#__PURE__*/_react.default.createElement("span", {
    className: "claim",
    "data-onclick": onclick(duplicate)
  }, duplicate.claim), /*#__PURE__*/_react.default.createElement("div", {
    className: "details",
    id: `details-${duplicate.claimId}`
  }, sourceMap[duplicate.commentId].interview && /*#__PURE__*/_react.default.createElement(_react.default.Fragment, null, "Interview:", " ", /*#__PURE__*/_react.default.createElement("span", {
    className: "interview"
  }, "\"", sourceMap[duplicate.commentId].interview, "\""), " ", /*#__PURE__*/_react.default.createElement("br", null)), sourceMap[duplicate.commentId].video && /*#__PURE__*/_react.default.createElement("iframe", {
    id: `video-${duplicate.claimId}`,
    className: "video",
    src: "",
    width: "250",
    height: "141",
    allow: "autoplay; fullscreen; picture-in-picture"
  }), /*#__PURE__*/_react.default.createElement("br", null), "Quote:", " ", /*#__PURE__*/_react.default.createElement("span", {
    className: "quote"
  }, "\"", duplicate.quote, "\""))))))))))))))));
};
exports.Report = Report;
const html = async data => {
  let str = _server.default.renderToString( /*#__PURE__*/_react.default.createElement(Report, {
    data: data
  }));
  str = str.replace(/data-onclick/g, "onclick");
  str = str.replace(/&gt;/g, ">");
  str = str.replace(/&#x27;/g, "'");
  str = await prettier.format(str, {
    parser: "html"
  });
  return str;
};
var _default = exports.default = html;