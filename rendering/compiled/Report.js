import React from "react";
const ReportPage = ({
  data
}) => {
  const sourceMap = {};
  data.data.forEach(d => {
    sourceMap[d.id] = d;
  });
  const onclick = claim => {
    let callback = `document.getElementById(${claim.claimId}).classList.toggle("open");`;
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
  return /*#__PURE__*/React.createElement("html", null, /*#__PURE__*/React.createElement("style", null), /*#__PURE__*/React.createElement("h1", {
    id: "title"
  }, data.title), /*#__PURE__*/React.createElement("h1", {
    id: "question"
  }, data.question), /*#__PURE__*/React.createElement("div", {
    className: "report-description"
  }, data.description), data.tree.map(topic => /*#__PURE__*/React.createElement("div", {
    key: topic.topicId
  }, /*#__PURE__*/React.createElement("h2", null, topic.topicName, " ", /*#__PURE__*/React.createElement("span", {
    className: "count"
  }, "(", topic.claimsCount, ")")), /*#__PURE__*/React.createElement("div", {
    className: "topic-description"
  }, topic.topicShortDescription), topic.subtopics.map(subtopic => /*#__PURE__*/React.createElement("div", {
    key: subtopic.subtopicId,
    className: "subtopic",
    id: subtopic.subtopicId
  }, /*#__PURE__*/React.createElement("h3", null, subtopic.subtopicName, " ", /*#__PURE__*/React.createElement("span", {
    className: "count"
  }, "(", subtopic.claims.length, ")")), /*#__PURE__*/React.createElement("div", {
    className: "subtopic-description"
  }, subtopic.subtopicShortDescription), /*#__PURE__*/React.createElement("ul", null, subtopic.claims.map(claim => /*#__PURE__*/React.createElement("li", {
    key: claim.claimId,
    id: claim.claimId
  }, /*#__PURE__*/React.createElement("span", {
    className: "claim",
    "data-onclick": onclick(claim)
  }, claim.claim, " ", claim.duplicates ? ` (x${1 + claim.duplicates.length})` : ""), /*#__PURE__*/React.createElement("div", {
    className: "details",
    id: `details-${claim.claimId}`
  }, sourceMap[claim.commentId].interview && /*#__PURE__*/React.createElement(React.Fragment, null, "Interview:", " ", /*#__PURE__*/React.createElement("span", {
    className: "interview"
  }, "\"", sourceMap[claim.commentId].interview, "\""), " ", /*#__PURE__*/React.createElement("br", null)), sourceMap[claim.commentId].video && /*#__PURE__*/React.createElement("iframe", {
    id: `video-${claim.claimId}`,
    className: "video",
    src: "",
    width: "250",
    height: "141",
    allow: "autoplay; fullscreen; picture-in-picture"
  }), /*#__PURE__*/React.createElement("br", null), "Quote: ", /*#__PURE__*/React.createElement("span", {
    className: "quote"
  }, "\"", claim.quote, "\""), claim.duplicates && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", null, "Similar claims:"), /*#__PURE__*/React.createElement("ul", null, claim.duplicates.map(duplicate => /*#__PURE__*/React.createElement("li", {
    key: duplicate.claimId,
    id: duplicate.claimId
  }, /*#__PURE__*/React.createElement("span", {
    className: "claim",
    "data-onclick": onclick(duplicate)
  }, duplicate.claim), /*#__PURE__*/React.createElement("div", {
    className: "details",
    id: `details-${duplicate.claimId}`
  }, sourceMap[duplicate.commentId].interview && /*#__PURE__*/React.createElement(React.Fragment, null, "Interview:", " ", /*#__PURE__*/React.createElement("span", {
    className: "interview"
  }, "\"", sourceMap[duplicate.commentId].interview, "\""), " ", /*#__PURE__*/React.createElement("br", null)), sourceMap[duplicate.commentId].video && /*#__PURE__*/React.createElement("iframe", {
    id: `video-${duplicate.claimId}`,
    className: "video",
    src: "",
    width: "250",
    height: "141",
    allow: "autoplay; fullscreen; picture-in-picture"
  }), /*#__PURE__*/React.createElement("br", null), "Quote:", " ", /*#__PURE__*/React.createElement("span", {
    className: "quote"
  }, "\"", duplicate.quote, "\"")))))))))))))));
};
export default ReportPage;