"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = Report;
function Report({
  data
}) {
  const sourceMap = data.data.reduce((acc, d) => ({
    ...acc,
    [d.id]: d
  }), {});
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h1", {
    id: "title"
  }, data.title), /*#__PURE__*/React.createElement("h1", {
    id: "question"
  }, data.question), /*#__PURE__*/React.createElement("div", {
    className: "report-description"
  }, data.description), /*#__PURE__*/React.createElement(Outline, {
    data: data
  }), data.tree.map((topic, i) => /*#__PURE__*/React.createElement(TopicComponent, {
    i: i,
    key: topic.topicId,
    topic: topic,
    sourceMap: sourceMap
  })));
}
function Outline({
  data
}) {
  let totalClaims = 0;
  data.tree.forEach(topic => totalClaims += topic.claimsCount);
  const rows = [];
  data.tree.forEach((topic, i) => {
    rows.push( /*#__PURE__*/React.createElement("tr", {
      key: i,
      className: "outline-topic-row"
    }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("a", {
      href: `#${topic.topicId}`
    }, i + 1, ". ", topic.topicName)), /*#__PURE__*/React.createElement("td", null, topic.claimsCount), /*#__PURE__*/React.createElement("td", null, (100 * topic.claimsCount / totalClaims).toFixed(0), "%")));
    topic.subtopics.forEach((subtopic, j) => {
      rows.push( /*#__PURE__*/React.createElement("tr", {
        key: `${i}/${j}`,
        className: "outline-subtopic-row"
      }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("a", {
        href: `#${subtopic.subtopicId}`
      }, i + 1, ".", j + 1, ". ", subtopic.subtopicName)), /*#__PURE__*/React.createElement("td", null, subtopic.claimsCount), /*#__PURE__*/React.createElement("td", null, (100 * subtopic.claimsCount / totalClaims).toFixed(0), "%")));
    });
  });
  return /*#__PURE__*/React.createElement("div", {
    id: "outline"
  }, /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Topic/Subtopic"), /*#__PURE__*/React.createElement("th", null, "Claims"), /*#__PURE__*/React.createElement("th", null, "%"))), /*#__PURE__*/React.createElement("tbody", null, rows)));
}
function TopicComponent({
  topic,
  i,
  sourceMap
}) {
  return /*#__PURE__*/React.createElement("div", {
    id: topic.topicId
  }, /*#__PURE__*/React.createElement("h2", null, i + 1, ". ", topic.topicName, " ", /*#__PURE__*/React.createElement("span", {
    className: "count"
  }, "(", topic.claimsCount, ")")), /*#__PURE__*/React.createElement("div", {
    className: "topic-description"
  }, topic.topicShortDescription), topic.subtopics.map((subtopic, j) => /*#__PURE__*/React.createElement(SubtopicComponent, {
    i: i,
    j: j,
    key: subtopic.subtopicId,
    subtopic: subtopic,
    sourceMap: sourceMap
  })));
}
function SubtopicComponent({
  subtopic,
  i,
  j,
  sourceMap
}) {
  // const showMoreOnclick = (subtopicId:string) => {
  //     'use client'
  //     document.getElementById(`${subtopicId}`)?.classList.toggle('showmore')
  // }

  return /*#__PURE__*/React.createElement("div", {
    className: "subtopic",
    id: subtopic.subtopicId
  }, /*#__PURE__*/React.createElement("h3", null, i + 1, ".", j + 1, ". ", subtopic.subtopicName, " ", /*#__PURE__*/React.createElement("span", {
    className: "count"
  }, "(", subtopic.claims.length, ")")), /*#__PURE__*/React.createElement("div", {
    className: "subtopic-description"
  }, subtopic.subtopicShortDescription), /*#__PURE__*/React.createElement("ul", null, subtopic.claims.slice(0, 5).map(claim => /*#__PURE__*/React.createElement(ClaimComponent, {
    key: claim.claimId,
    claim: claim,
    sourceMap: sourceMap
  })), subtopic.claims.length > 5 && /*#__PURE__*/React.createElement("button", {
    className: "showmore-button"
    // data-onclick={showMoreOnclick(subtopic.subtopicId!)}
  }, "show all"), subtopic.claims.slice(5).map(claim => /*#__PURE__*/React.createElement(ClaimComponent, {
    key: claim.claimId,
    claim: claim,
    sourceMap: sourceMap,
    more: true
  })), subtopic.claims.length > 5 && /*#__PURE__*/React.createElement("button", {
    className: "showless-button"
    // data-onclick={showMoreOnclick(subtopic.subtopicId!)}
  }, "show less")));
}
function ClaimComponent({
  claim,
  sourceMap,
  more
}) {
  // const onClaimClick = (sourceMap: SourceMap, claim: Claim) => {
  //     return ()=> {
  //         'use client'

  //         // toggle opening claim
  //         document.getElementById(`${claim.claimId}`)?.classList.toggle('open')

  //         const {video, timestamp} = sourceMap[claim.commentId!]
  //         if (video) {
  //             const parts = video.split("/");
  //             const videoId = parts[parts.length - 1];
  //             let [hours, minutes, seconds] = timestamp!.split(":").map(Number);
  //             let totalSeconds = hours * 3600 + minutes * 60 + seconds;
  //             // note that we're only loading video when the user clicks on the claim
  //             // that's for performance reasons and to work around a vimeo bug...
  //             const src = `https://player.vimeo.com/video/${videoId}#t=${totalSeconds}s`;
  //             (document.getElementById('video-${claim.claimId}') as HTMLVideoElement).src = src;
  //         }
  //     }

  // };

  return /*#__PURE__*/React.createElement("li", {
    id: claim.claimId,
    className: more ? "more" : ""
  }, /*#__PURE__*/React.createElement("span", {
    className: "claim"
    // data-onclick={onClaimClick(sourceMap, claim)}
  }, claim.claim, " ", claim.duplicates && claim.duplicates.length ? ` (x${1 + claim.duplicates.length})` : ""), /*#__PURE__*/React.createElement(ClaimDetailComponent, {
    claim: claim,
    sourceMap: sourceMap
  }));
}
function ClaimDetailComponent({
  claim,
  sourceMap
}) {
  return /*#__PURE__*/React.createElement("div", {
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
  }, "\"", claim.quote, "\""), claim.duplicates && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", null, "Similar claims:"), /*#__PURE__*/React.createElement("ul", null, claim.duplicates.map(duplicate => /*#__PURE__*/React.createElement(ClaimComponent, {
    key: duplicate.claimId,
    claim: duplicate,
    sourceMap: sourceMap
  })))));
}