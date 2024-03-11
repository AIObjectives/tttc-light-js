import React from "react";
import styles from "./styles";
import ReactDOMServer from "react-dom/server";
import * as prettier from "prettier";

import {
  PipelineOutput,
  Claim,
  SourceMap,
  Topic,
  Subtopic,
  PieChart,
} from "./types";
type ReportProps = { data: PipelineOutput };
type TopicProps = { i: number; topic: Topic; sourceMap: SourceMap };
type SubtopicProps = {
  i: number;
  j: number;
  subtopic: Subtopic;
  sourceMap: SourceMap;
};
type ClaimProps = { claim: Claim; sourceMap: SourceMap; more?: boolean };
type ClaimDetailProps = { claim: Claim; sourceMap: SourceMap };

export const Report = ({ data }: ReportProps) => {
  const sourceMap: SourceMap = data.data.reduce(
    (acc, d) => ({ ...acc, [d.id]: d }),
    {}
  );
  const pieCharts = data.pieCharts || [];
  return (
    <html>
      <head>
        <style>{styles}</style>
        {pieCharts.length && (
          <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
        )}
      </head>
      <body>
        <h1 id="title">{data.title}</h1>
        <h1 id="question">{data.question}</h1>
        <div className="report-description">{data.description}</div>
        {pieCharts.map((_, i) => (
          <div id={`piechart_${i}`} />
        ))}
        <Outline data={data} />
        {data.tree.map((topic, i) => (
          <TopicComponent
            i={i}
            key={topic.topicId}
            topic={topic}
            sourceMap={sourceMap}
          />
        ))}
        {pieCharts.length && (
          <script>
            {pieCharts
              .map((pieChart, i) => pieChartScript(pieChart, i))
              .join("\n\n")}
          </script>
        )}
      </body>
    </html>
  );
};

const SHOW_STATS = false; // TODO: provide this as an option

const Outline = ({ data }: ReportProps) => {
  let totalClaims = 0;
  data.tree.forEach((topic) => (totalClaims += topic.claimsCount!));
  const rows: any = [];
  data.tree.forEach((topic, i) => {
    rows.push(
      <tr key={i} className="outline-topic-row">
        <td>
          <a href={`#${topic.topicId}`}>
            {i + 1}. {topic.topicName}
          </a>
        </td>
        <td>{topic.claimsCount}</td>
        {SHOW_STATS && (
          <td>{((100 * topic.claimsCount!) / totalClaims).toFixed(0)}%</td>
        )}
      </tr>
    );
    topic.subtopics.forEach((subtopic, j) => {
      rows.push(
        <tr key={`${i}/${j}`} className="outline-subtopic-row">
          <td>
            <a href={`#${subtopic.subtopicId}`}>
              {i + 1}.{j + 1}. {subtopic.subtopicName}
            </a>
          </td>
          <td>{subtopic.claimsCount}</td>
          {SHOW_STATS && (
            <td>{((100 * subtopic.claimsCount!) / totalClaims).toFixed(0)}%</td>
          )}
        </tr>
      );
    });
  });
  return (
    <div id="outline">
      <table>
        <thead>
          <tr>
            <th>Topic/Subtopic</th>
            <th>Arguments</th>
            {SHOW_STATS && <th>%</th>}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
};

const TopicComponent = ({ topic, i, sourceMap }: TopicProps) => (
  <div id={topic.topicId}>
    <h2>
      {i + 1}. {topic.topicName}{" "}
      <span className="count">({topic.claimsCount})</span>
    </h2>
    <div className="topic-description">{topic.topicShortDescription}</div>
    {topic.subtopics.map((subtopic, j) => (
      <SubtopicComponent
        i={i}
        j={j}
        key={subtopic.subtopicId}
        subtopic={subtopic}
        sourceMap={sourceMap}
      />
    ))}
  </div>
);

const SubtopicComponent = ({ subtopic, i, j, sourceMap }: SubtopicProps) => (
  <div className="subtopic" id={subtopic.subtopicId}>
    <h3>
      {i + 1}.{j + 1}. {subtopic.subtopicName}{" "}
      <span className="count">({subtopic.claims!.length})</span>
    </h3>
    <div className="subtopic-description">
      {subtopic.subtopicShortDescription}
    </div>
    <ul>
      {subtopic.claims!.slice(0, 5).map((claim) => (
        <ClaimComponent
          key={claim.claimId}
          claim={claim}
          sourceMap={sourceMap}
        />
      ))}
      {subtopic.claims!.length > 5 && (
        <button
          className="showmore-button"
          data-onclick={showMoreOnclick(subtopic.subtopicId!)}
        >
          show all
        </button>
      )}
      {subtopic.claims!.slice(5).map((claim) => (
        <ClaimComponent
          key={claim.claimId}
          claim={claim}
          sourceMap={sourceMap}
          more
        />
      ))}
      {subtopic.claims!.length > 5 && (
        <button
          className="showless-button"
          data-onclick={showMoreOnclick(subtopic.subtopicId!)}
        >
          show less
        </button>
      )}
    </ul>
  </div>
);

const ClaimComponent = ({ claim, sourceMap, more }: ClaimProps) => (
  <li id={claim.claimId} className={more ? "more" : ""}>
    <span className="claim" data-onclick={onClaimClick(sourceMap, claim)}>
      {claim.claim}{" "}
      {claim.duplicates && claim.duplicates.length
        ? ` (x${1 + claim.duplicates.length})`
        : ""}
    </span>
    <ClaimDetailComponent claim={claim} sourceMap={sourceMap} />
  </li>
);

const ClaimDetailComponent = ({ claim, sourceMap }: ClaimDetailProps) => (
  <div className="details" id={`details-${claim.claimId}`}>
    {sourceMap[claim.commentId!].interview && (
      <>
        Interview:{" "}
        <span className="interview">
          "{sourceMap[claim.commentId!].interview}"
        </span>{" "}
        <br />
      </>
    )}
    {sourceMap[claim.commentId!].video && (
      <iframe
        id={`video-${claim.claimId}`}
        className="video"
        src=""
        width="250"
        height="141"
        allow="autoplay; fullscreen; picture-in-picture"
      ></iframe>
    )}
    <br />
    Quote: <span className="quote">"{claim.quote}"</span>
    {claim.duplicates && claim.duplicates.length && (
      <div>
        <br />
        <div>Similar claims:</div>
        <ul>
          {claim.duplicates.map((duplicate) => (
            <ClaimComponent
              key={duplicate.claimId}
              claim={duplicate}
              sourceMap={sourceMap}
            />
          ))}
        </ul>
      </div>
    )}
  </div>
);

const onClaimClick = (sourceMap: SourceMap, claim: Claim) => {
  let callback = `document.getElementById('${claim.claimId}').classList.toggle('open');`;
  const { video, timestamp } = sourceMap[claim.commentId!];
  if (video) {
    const parts = video.split("/");
    const videoId = parts[parts.length - 1];
    let [hours, minutes, seconds] = timestamp!.split(":").map(Number);
    let totalSeconds = hours * 3600 + minutes * 60 + seconds;
    // note that we're only loading video when the user clicks on the claim
    // that's for performance reasons and to work around a vimeo bug...
    const src = `https://player.vimeo.com/video/${videoId}#t=${totalSeconds}s`;
    callback += `document.getElementById('video-${claim.claimId}').src = '${src}';`;
  }
  return callback;
};

const showMoreOnclick = (subtopicId: String) => {
  return `document.getElementById('${subtopicId}').classList.toggle('showmore');`;
};

const pieChartScript = (pieChart: PieChart, i: number) => `
const data_${i} = ${JSON.stringify(pieChart)};
const plotData_${i} = [{
  type: 'pie',
  values: data_${i}.map(item => item.count),
  labels: data_${i}.map(item => item.label),
  textinfo: "label+percent",
  insidetextorientation: "radial"
}];
Plotly.newPlot('piechart_${i}', plotData_${i}, {height: 400, width: 500});`;

const html = async (data: PipelineOutput) => {
  let str = ReactDOMServer.renderToString(<Report data={data} />);
  str = str.replace(/data-onclick/g, "onclick");
  str = str.replace(/&gt;/g, ">");
  str = str.replace(/&lt;/g, "<");
  str = str.replace(/&#x27;/g, "'");
  str = str.replace(/&quot;/g, '"');
  str = await prettier.format(str, { parser: "html" });
  return str;
};

export default html;
