"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.Report = void 0;
const react_1 = __importDefault(require("react"));
function Report(props) {
  const { data } = props;
  const sourceMap = data.data.reduce(
    (acc, d) => Object.assign(Object.assign({}, acc), { [d.id]: d }),
    {},
  );
  return react_1.default.createElement(
    react_1.default.Fragment,
    null,
    react_1.default.createElement("h1", { id: "title" }, data.title),
    react_1.default.createElement("h1", { id: "question" }, data.question),
    react_1.default.createElement(
      "div",
      { className: "report-description" },
      data.description,
    ),
    react_1.default.createElement(Outline, Object.assign({}, props)),
    data.tree.map((topic, i) =>
      react_1.default.createElement(TopicComponent, {
        i: i,
        key: topic.topicId,
        topic: topic,
        sourceMap: sourceMap,
        ToggleShowMoreComponent: props.ToggleShowMoreComponent,
        OpenClaimVideo: props.OpenClaimVideo,
      }),
    ),
  );
}
exports.Report = Report;
function Outline({ data }) {
  let totalClaims = 0;
  data.tree.forEach((topic) => (totalClaims += topic.claimsCount));
  const rows = [];
  data.tree.forEach((topic, i) => {
    rows.push(
      react_1.default.createElement(
        "tr",
        { key: i, className: "outline-topic-row" },
        react_1.default.createElement(
          "td",
          null,
          react_1.default.createElement(
            "a",
            { href: `#${topic.topicId}` },
            i + 1,
            ". ",
            topic.topicName,
          ),
        ),
        react_1.default.createElement("td", null, topic.claimsCount),
        react_1.default.createElement(
          "td",
          null,
          ((100 * topic.claimsCount) / totalClaims).toFixed(0),
          "%",
        ),
      ),
    );
    topic.subtopics.forEach((subtopic, j) => {
      rows.push(
        react_1.default.createElement(
          "tr",
          { key: `${i}/${j}`, className: "outline-subtopic-row" },
          react_1.default.createElement(
            "td",
            null,
            react_1.default.createElement(
              "a",
              { href: `#${subtopic.subtopicId}` },
              i + 1,
              ".",
              j + 1,
              ". ",
              subtopic.subtopicName,
            ),
          ),
          react_1.default.createElement("td", null, subtopic.claimsCount),
          react_1.default.createElement(
            "td",
            null,
            ((100 * subtopic.claimsCount) / totalClaims).toFixed(0),
            "%",
          ),
        ),
      );
    });
  });
  return react_1.default.createElement(
    "div",
    { id: "outline" },
    react_1.default.createElement(
      "table",
      null,
      react_1.default.createElement(
        "thead",
        null,
        react_1.default.createElement(
          "tr",
          null,
          react_1.default.createElement("th", null, "Topic/Subtopic"),
          react_1.default.createElement("th", null, "Claims"),
          react_1.default.createElement("th", null, "%"),
        ),
      ),
      react_1.default.createElement("tbody", null, rows),
    ),
  );
}
function TopicComponent({
  topic,
  i,
  sourceMap,
  ToggleShowMoreComponent,
  OpenClaimVideo,
}) {
  return react_1.default.createElement(
    "div",
    { id: topic.topicId },
    react_1.default.createElement(
      "h2",
      null,
      i + 1,
      ". ",
      topic.topicName,
      " ",
      react_1.default.createElement(
        "span",
        { className: "count" },
        "(",
        topic.claimsCount,
        ")",
      ),
    ),
    react_1.default.createElement(
      "div",
      { className: "topic-description" },
      topic.topicShortDescription,
    ),
    topic.subtopics.map((subtopic, j) =>
      react_1.default.createElement(SubtopicComponent, {
        i: i,
        j: j,
        key: subtopic.subtopicId,
        subtopic: subtopic,
        sourceMap: sourceMap,
        ToggleShowMoreComponent: ToggleShowMoreComponent,
        OpenClaimVideo: OpenClaimVideo,
      }),
    ),
  );
}
function SubtopicComponent({
  subtopic,
  i,
  j,
  sourceMap,
  ToggleShowMoreComponent,
  OpenClaimVideo,
}) {
  return react_1.default.createElement(
    "div",
    { className: "subtopic", id: subtopic.subtopicId },
    react_1.default.createElement(
      "h3",
      null,
      i + 1,
      ".",
      j + 1,
      ". ",
      subtopic.subtopicName,
      " ",
      react_1.default.createElement(
        "span",
        { className: "count" },
        "(",
        subtopic.claims.length,
        ")",
      ),
    ),
    react_1.default.createElement(
      "div",
      { className: "subtopic-description" },
      subtopic.subtopicShortDescription,
    ),
    react_1.default.createElement(
      "ul",
      null,
      subtopic.claims
        .slice(0, 5)
        .map((claim) =>
          react_1.default.createElement(ClaimComponent, {
            key: claim.claimId,
            claim: claim,
            sourceMap: sourceMap,
            ToggleShowMoreComponent: ToggleShowMoreComponent,
            OpenClaimVideo: OpenClaimVideo,
          }),
        ),
      subtopic.claims.length > 5 &&
        react_1.default.createElement(
          ToggleShowMoreComponent,
          { subtopic: subtopic, className: "showmore-button" },
          "show all",
        ),
      subtopic.claims
        .slice(5)
        .map((claim) =>
          react_1.default.createElement(ClaimComponent, {
            key: claim.claimId,
            claim: claim,
            sourceMap: sourceMap,
            OpenClaimVideo: OpenClaimVideo,
            ToggleShowMoreComponent: ToggleShowMoreComponent,
            more: true,
          }),
        ),
      subtopic.claims.length > 5 &&
        react_1.default.createElement(
          ToggleShowMoreComponent,
          { subtopic: subtopic, className: "showless-button" },
          "show less",
        ),
    ),
  );
}
function ClaimComponent({
  claim,
  sourceMap,
  more,
  ToggleShowMoreComponent,
  OpenClaimVideo,
}) {
  return react_1.default.createElement(
    "li",
    { id: claim.claimId, className: more ? "more" : "" },
    react_1.default.createElement(
      OpenClaimVideo,
      { sourceMap: sourceMap, claim: claim },
      claim.claim,
      " ",
      claim.duplicates && claim.duplicates.length
        ? ` (x${1 + claim.duplicates.length})`
        : "",
    ),
    react_1.default.createElement(ClaimDetailComponent, {
      claim: claim,
      sourceMap: sourceMap,
      ToggleShowMoreComponent: ToggleShowMoreComponent,
      OpenClaimVideo: OpenClaimVideo,
    }),
  );
}
function ClaimDetailComponent({
  claim,
  sourceMap,
  ToggleShowMoreComponent,
  OpenClaimVideo,
}) {
  return react_1.default.createElement(
    "div",
    { className: "details", id: `details-${claim.claimId}` },
    sourceMap[claim.commentId].interview &&
      react_1.default.createElement(
        react_1.default.Fragment,
        null,
        "Interview:",
        " ",
        react_1.default.createElement(
          "span",
          { className: "interview" },
          '"',
          sourceMap[claim.commentId].interview,
          '"',
        ),
        " ",
        react_1.default.createElement("br", null),
      ),
    sourceMap[claim.commentId].video &&
      react_1.default.createElement("iframe", {
        id: `video-${claim.claimId}`,
        className: "video",
        src: "",
        width: "250",
        height: "141",
        allow: "autoplay; fullscreen; picture-in-picture",
      }),
    react_1.default.createElement("br", null),
    "Quote: ",
    react_1.default.createElement(
      "span",
      { className: "quote" },
      '"',
      claim.quote,
      '"',
    ),
    claim.duplicates &&
      react_1.default.createElement(
        "div",
        null,
        react_1.default.createElement("div", null, "Similar claims:"),
        react_1.default.createElement(
          "ul",
          null,
          claim.duplicates.map((duplicate) =>
            react_1.default.createElement(ClaimComponent, {
              key: duplicate.claimId,
              claim: duplicate,
              sourceMap: sourceMap,
              OpenClaimVideo: OpenClaimVideo,
              ToggleShowMoreComponent: ToggleShowMoreComponent,
            }),
          ),
        ),
      ),
  );
}
// export function ReportCSR(props:ReportProps) {
//   return <Report {...props} ToggleShowMoreComponent={ClientSideToggleShowMoreButton}
//   OpenClaimVideo={ClientSideOpenClaimVideo} />
// }
// export function ReportSSR(props:ReportProps) {
//   return <Report {...props} ToggleShowMoreComponent={ServerSideToggleShowMoreButton} OpenClaimVideo={ServerSideOpenClaimVideo}/>
// }
function ServerSideToggleShowMoreButton({ children, subtopic, className }) {
  const showMoreOnclick = (subtopicId) => {
    return `document.getElementById('${subtopicId}').classList.toggle('showmore');`;
  };
  return react_1.default.createElement(
    "button",
    {
      className: className,
      "data-onclick": showMoreOnclick(subtopic.subtopicId),
    },
    children,
  );
}
function ServerSideOpenClaimVideo({ children, sourceMap, claim }) {
  const onClaimClick = (sourceMap, claim) => {
    let callback = `document.getElementById('${claim.claimId}').classList.toggle('open');`;
    const { video, timestamp } = sourceMap[claim.commentId];
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
  return react_1.default.createElement(
    "span",
    { className: "claim", "data-onclick": onClaimClick(sourceMap, claim) },
    children,
  );
}
//# sourceMappingURL=Report.js.map
