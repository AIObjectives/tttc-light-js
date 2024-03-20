"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = ReportSSR;
var _react = _interopRequireDefault(require("react"));
var _Report = require("tttc-common/components/Report/Report.js");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function ServerSideToggleShowMoreButton({
  children,
  subtopic,
  className
}) {
  const showMoreOnclick = subtopicId => {
    return `document.getElementById('${subtopicId}').classList.toggle('showmore');`;
  };
  return /*#__PURE__*/_react.default.createElement("button", {
    className: className,
    "data-onclick": showMoreOnclick(subtopic.subtopicId)
  }, children);
}
function ServerSideOpenClaimVideo({
  children,
  sourceMap,
  claim
}) {
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
  return /*#__PURE__*/_react.default.createElement("span", {
    className: "claim",
    "data-onclick": onClaimClick(sourceMap, claim)
  }, children);
}
function ReportSSR({
  data
}) {
  return /*#__PURE__*/_react.default.createElement(_Report.Report, {
    data: data,
    ToggleShowMoreComponent: ServerSideToggleShowMoreButton,
    OpenClaimVideo: ServerSideOpenClaimVideo
  });
}