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
  const sourceMap = data.data.reduce((acc, d) => ({
    ...acc,
    [d.id]: d
  }), {});
  const pieCharts = data.pieCharts || [];
  return /*#__PURE__*/_react.default.createElement("html", null, /*#__PURE__*/_react.default.createElement("head", null, /*#__PURE__*/_react.default.createElement("style", null, _styles.default), pieCharts.length && /*#__PURE__*/_react.default.createElement("script", {
    src: "https://cdn.plot.ly/plotly-latest.min.js"
  })), /*#__PURE__*/_react.default.createElement("body", null, /*#__PURE__*/_react.default.createElement("h1", {
    id: "title"
  }, data.title), /*#__PURE__*/_react.default.createElement("h1", {
    id: "question"
  }, data.question), /*#__PURE__*/_react.default.createElement("div", {
    className: "report-description"
  }, data.description), pieCharts.length && /*#__PURE__*/_react.default.createElement("div", {
    className: "piecharts"
  }, pieCharts.map((_, i) => /*#__PURE__*/_react.default.createElement("div", {
    key: i,
    id: `piechart_${i}`
  }))), /*#__PURE__*/_react.default.createElement(Outline, {
    data: data
  }), data.tree.map((topic, i) => /*#__PURE__*/_react.default.createElement(TopicComponent, {
    i: i,
    key: topic.topicId,
    topic: topic,
    sourceMap: sourceMap
  })), pieCharts.length && /*#__PURE__*/_react.default.createElement("script", null, pieCharts.map((pieChart, i) => pieChartScript(pieChart, i)).join("\n\n"))));
};
exports.Report = Report;
const SHOW_STATS = false; // TODO: provide this as an option

const Outline = ({
  data
}) => {
  let totalClaims = 0;
  data.tree.forEach(topic => totalClaims += topic.claimsCount);
  const rows = [];
  data.tree.forEach((topic, i) => {
    rows.push( /*#__PURE__*/_react.default.createElement("tr", {
      key: i,
      className: "outline-topic-row"
    }, /*#__PURE__*/_react.default.createElement("td", null, /*#__PURE__*/_react.default.createElement("a", {
      href: `#${topic.topicId}`
    }, i + 1, ". ", topic.topicName)), /*#__PURE__*/_react.default.createElement("td", null, topic.claimsCount), SHOW_STATS && /*#__PURE__*/_react.default.createElement("td", null, (100 * topic.claimsCount / totalClaims).toFixed(0), "%")));
    topic.subtopics.forEach((subtopic, j) => {
      rows.push( /*#__PURE__*/_react.default.createElement("tr", {
        key: `${i}/${j}`,
        className: "outline-subtopic-row"
      }, /*#__PURE__*/_react.default.createElement("td", null, /*#__PURE__*/_react.default.createElement("a", {
        href: `#${subtopic.subtopicId}`
      }, i + 1, ".", j + 1, ". ", subtopic.subtopicName)), /*#__PURE__*/_react.default.createElement("td", null, subtopic.claimsCount), SHOW_STATS && /*#__PURE__*/_react.default.createElement("td", null, (100 * subtopic.claimsCount / totalClaims).toFixed(0), "%")));
    });
  });
  return /*#__PURE__*/_react.default.createElement("div", {
    id: "outline"
  }, /*#__PURE__*/_react.default.createElement("table", null, /*#__PURE__*/_react.default.createElement("thead", null, /*#__PURE__*/_react.default.createElement("tr", null, /*#__PURE__*/_react.default.createElement("th", null, "Topic/Subtopic"), /*#__PURE__*/_react.default.createElement("th", null, "Arguments"), SHOW_STATS && /*#__PURE__*/_react.default.createElement("th", null, "%"))), /*#__PURE__*/_react.default.createElement("tbody", null, rows)));
};
const TopicComponent = ({
  topic,
  i,
  sourceMap
}) => /*#__PURE__*/_react.default.createElement("div", {
  id: topic.topicId
}, /*#__PURE__*/_react.default.createElement("h2", null, i + 1, ". ", topic.topicName, " ", /*#__PURE__*/_react.default.createElement("span", {
  className: "count"
}, "(", topic.claimsCount, ")")), /*#__PURE__*/_react.default.createElement("div", {
  className: "topic-description"
}, topic.topicShortDescription), topic.subtopics.map((subtopic, j) => /*#__PURE__*/_react.default.createElement(SubtopicComponent, {
  i: i,
  j: j,
  key: subtopic.subtopicId,
  subtopic: subtopic,
  sourceMap: sourceMap
})));
const SubtopicComponent = ({
  subtopic,
  i,
  j,
  sourceMap
}) => /*#__PURE__*/_react.default.createElement("div", {
  className: "subtopic",
  id: subtopic.subtopicId
}, /*#__PURE__*/_react.default.createElement("h3", null, i + 1, ".", j + 1, ". ", subtopic.subtopicName, " ", /*#__PURE__*/_react.default.createElement("span", {
  className: "count"
}, "(", subtopic.claims.length, ")")), /*#__PURE__*/_react.default.createElement("div", {
  className: "subtopic-description"
}, subtopic.subtopicShortDescription), /*#__PURE__*/_react.default.createElement("ul", null, subtopic.claims.slice(0, 5).map(claim => /*#__PURE__*/_react.default.createElement(ClaimComponent, {
  key: claim.claimId,
  claim: claim,
  sourceMap: sourceMap
})), subtopic.claims.length > 5 && /*#__PURE__*/_react.default.createElement("button", {
  className: "showmore-button",
  "data-onclick": showMoreOnclick(subtopic.subtopicId)
}, "show all"), subtopic.claims.slice(5).map(claim => /*#__PURE__*/_react.default.createElement(ClaimComponent, {
  key: claim.claimId,
  claim: claim,
  sourceMap: sourceMap,
  more: true
})), subtopic.claims.length > 5 && /*#__PURE__*/_react.default.createElement("button", {
  className: "showless-button",
  "data-onclick": showMoreOnclick(subtopic.subtopicId)
}, "show less")));
const ClaimComponent = ({
  claim,
  sourceMap,
  more
}) => /*#__PURE__*/_react.default.createElement("li", {
  id: claim.claimId,
  className: more ? "more" : ""
}, /*#__PURE__*/_react.default.createElement("span", {
  className: "claim",
  "data-onclick": onClaimClick(sourceMap, claim)
}, claim.claim, " ", claim.duplicates && claim.duplicates.length ? ` (x${1 + claim.duplicates.length})` : ""), /*#__PURE__*/_react.default.createElement(ClaimDetailComponent, {
  claim: claim,
  sourceMap: sourceMap
}));
const ClaimDetailComponent = ({
  claim,
  sourceMap
}) => /*#__PURE__*/_react.default.createElement("div", {
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
}, "\"", claim.quote, "\""), claim.duplicates && claim.duplicates.length && /*#__PURE__*/_react.default.createElement("div", null, /*#__PURE__*/_react.default.createElement("br", null), /*#__PURE__*/_react.default.createElement("div", null, "Similar claims:"), /*#__PURE__*/_react.default.createElement("ul", null, claim.duplicates.map(duplicate => /*#__PURE__*/_react.default.createElement(ClaimComponent, {
  key: duplicate.claimId,
  claim: duplicate,
  sourceMap: sourceMap
})))));
const onClaimClick = (sourceMap, claim) => {
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
    // note that we're only loading video when the user clicks on the claim
    // that's for performance reasons and to work around a vimeo bug...
    const src = `https://player.vimeo.com/video/${videoId}#t=${totalSeconds}s`;
    callback += `document.getElementById('video-${claim.claimId}').src = '${src}';`;
  }
  return callback;
};
const showMoreOnclick = subtopicId => {
  return `document.getElementById('${subtopicId}').classList.toggle('showmore');`;
};
const pieChartScript = (pieChart, i) => `
const data_${i} = ${JSON.stringify(pieChart.items)};
const plotData_${i} = [{
  type: 'pie',
  values: data_${i}.map(item => item.count),
  labels: data_${i}.map(item => item.label),
  textinfo: "label+percent",
  insidetextorientation: "radial"
}];
/* Plotly lets long titles overflow the container; wrap titles at max 60 chars */
const wrappedTitle_${i} = "${pieChart.title}".replace(/([\\w\\s]{60,}?)\\s?\\b/g, "$1<br>");
console.log(wrappedTitle_${i})
Plotly.newPlot(
  'piechart_${i}', 
  plotData_${i},
  {height: 399, width: 399, title: {text: wrappedTitle_${i}, font: {size: 10}}},
  {staticPlot: true}
);`;
const html = async data => {
  let str = _server.default.renderToString( /*#__PURE__*/_react.default.createElement(Report, {
    data: data
  }));
  str = str.replace(/data-onclick/g, "onclick");
  str = str.replace(/&gt;/g, ">");
  str = str.replace(/&lt;/g, "<");
  str = str.replace(/&#x27;/g, "'");
  str = str.replace(/&quot;/g, '"');
  str = await prettier.format(str, {
    parser: "html"
  });
  return str;
};
var _default = exports.default = html;