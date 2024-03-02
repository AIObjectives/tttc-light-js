import React from "react";
import styles from "./styles";
import ReactDOMServer from "react-dom/server";
import * as prettier from "prettier";

import { PipelineOutput, Claim, SourceMap, Topic, Subtopic } from "./types";
type ReportProps = { data: PipelineOutput };
type TopicProps = { topic: Topic; sourceMap: SourceMap };
type SubtopicProps = { subtopic: Subtopic; sourceMap: SourceMap };
type ClaimProps = { claim: Claim; sourceMap: SourceMap };
type ClaimDetailProps = { claim: Claim; sourceMap: SourceMap };

export const Report = ({ data }: ReportProps) => {
  const sourceMap: SourceMap = data.data.reduce(
    (acc, d) => ({ ...acc, [d.id]: d }),
    {}
  );
  return (
    <html>
      <head>
        <style>{styles}</style>
      </head>
      <body>
        <h1 id="title">{data.title}</h1>
        <h1 id="question">{data.question}</h1>
        <div className="report-description">{data.description}</div>
        {data.tree.map((topic) => (
          <TopicComponent
            key={topic.topicId}
            topic={topic}
            sourceMap={sourceMap}
          />
        ))}
      </body>
    </html>
  );
};

const TopicComponent = ({ topic, sourceMap }: TopicProps) => (
  <div>
    <h2>
      {topic.topicName} <span className="count">({topic.claimsCount})</span>
    </h2>
    <div className="topic-description">{topic.topicShortDescription}</div>
    {topic.subtopics.map((subtopic) => (
      <SubtopicComponent
        key={subtopic.subtopicId}
        subtopic={subtopic}
        sourceMap={sourceMap}
      />
    ))}
  </div>
);

const SubtopicComponent = ({ subtopic, sourceMap }: SubtopicProps) => (
  <div className="subtopic" id={subtopic.subtopicId}>
    <h3>
      {subtopic.subtopicName}{" "}
      <span className="count">({subtopic.claims!.length})</span>
    </h3>
    <div className="subtopic-description">
      {subtopic.subtopicShortDescription}
    </div>
    <ul>
      {subtopic.claims!.map((claim) => (
        <ClaimComponent
          key={claim.claimId}
          claim={claim}
          sourceMap={sourceMap}
        />
      ))}
    </ul>
  </div>
);

const ClaimComponent = ({ claim, sourceMap }: ClaimProps) => (
  <li id={claim.claimId}>
    <span className="claim" data-onclick={onclick(sourceMap, claim)}>
      {claim.claim}{" "}
      {claim.duplicates ? ` (x${1 + claim.duplicates.length})` : ""}
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
    {claim.duplicates && (
      <div>
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

const onclick = (sourceMap: SourceMap, claim: Claim) => {
  let callback = `document.getElementById('${claim.claimId}').classList.toggle('open');`;
  const { video, timestamp } = sourceMap[claim.commentId!];
  if (video) {
    const parts = video.split("/");
    const videoId = parts[parts.length - 1];
    let [hours, minutes, seconds] = timestamp!.split(":").map(Number);
    let totalSeconds = hours * 3600 + minutes * 60 + seconds;
    const src = `https://player.vimeo.com/video/${videoId}#t=${totalSeconds}s`;
    callback += `document.getElementById('video-${claim.claimId}').src = '${src}';`;
  }
  return callback;
};

const html = async (data: PipelineOutput) => {
  let str = ReactDOMServer.renderToString(<Report data={data} />);
  str = str.replace(/data-onclick/g, "onclick");
  str = str.replace(/&gt;/g, ">");
  str = str.replace(/&#x27;/g, "'");
  str = await prettier.format(str, { parser: "html" });
  return str;
};

export default html;
