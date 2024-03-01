import React from "react";
import styles from "./styles";
import ReactDOMServer from "react-dom/server";
import * as prettier from "prettier";
import { PipelineOutput, SourceRow, Claim } from "./types";

export const Report = ({ data }: { data: PipelineOutput }) => {
  const sourceMap: { [key: string]: SourceRow } = {};
  data.data.forEach((d) => {
    sourceMap[d.id] = d;
  });

  const onclick = (claim: Claim) => {
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
          <div key={topic.topicId}>
            <h2>
              {topic.topicName}{" "}
              <span className="count">({topic.claimsCount})</span>
            </h2>
            <div className="topic-description">
              {topic.topicShortDescription}
            </div>
            {topic.subtopics.map((subtopic) => (
              <div
                key={subtopic.subtopicId}
                className="subtopic"
                id={subtopic.subtopicId}
              >
                <h3>
                  {subtopic.subtopicName}{" "}
                  <span className="count">({subtopic.claims!.length})</span>
                </h3>
                <div className="subtopic-description">
                  {subtopic.subtopicShortDescription}
                </div>
                <ul>
                  {subtopic.claims!.map((claim) => (
                    <li key={claim.claimId} id={claim.claimId}>
                      <span className="claim" data-onclick={onclick(claim)}>
                        {claim.claim}{" "}
                        {claim.duplicates
                          ? ` (x${1 + claim.duplicates.length})`
                          : ""}
                      </span>
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
                                <li
                                  key={duplicate.claimId}
                                  id={duplicate.claimId}
                                >
                                  <span
                                    className="claim"
                                    data-onclick={onclick(duplicate)}
                                  >
                                    {duplicate.claim}
                                  </span>
                                  <div
                                    className="details"
                                    id={`details-${duplicate.claimId}`}
                                  >
                                    {sourceMap[duplicate.commentId!]
                                      .interview && (
                                      <>
                                        Interview:{" "}
                                        <span className="interview">
                                          "
                                          {
                                            sourceMap[duplicate.commentId!]
                                              .interview
                                          }
                                          "
                                        </span>{" "}
                                        <br />
                                      </>
                                    )}
                                    {sourceMap[duplicate.commentId!].video && (
                                      <iframe
                                        id={`video-${duplicate.claimId}`}
                                        className="video"
                                        src=""
                                        width="250"
                                        height="141"
                                        allow="autoplay; fullscreen; picture-in-picture"
                                      ></iframe>
                                    )}
                                    <br />
                                    Quote:{" "}
                                    <span className="quote">
                                      "{duplicate.quote}"
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </body>
    </html>
  );
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
