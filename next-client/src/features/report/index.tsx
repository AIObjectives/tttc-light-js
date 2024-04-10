import React from "react";
import {
  PipelineOutput,
  Claim,
  SourceMap,
  Topic,
  Subtopic,
} from "tttc-common/schema";
import ToggleShowMoreButton from "./components/ToggleShowButton";
import OpenClaimVideo from "./components/OpenClaimVideo";

export interface OpenClaimVideoProps {
  children?: React.ReactNode;
  sourceMap: SourceMap;
  claim: Claim;
}

export interface ToggleShowMoreComponentProps {
  children?: React.ReactNode;
  subtopic: Subtopic;
  className: string;
}

export type ReportProps = { data: PipelineOutput };
type TopicProps = {
  i: number;
  topic: Topic;
  sourceMap: SourceMap;
};
type SubtopicProps = {
  i: number;
  j: number;
  subtopic: Subtopic;
  sourceMap: SourceMap;
};
type ClaimProps = {
  claim: Claim;
  sourceMap: SourceMap;
  more?: boolean;
};
type ClaimDetailProps = {
  claim: Claim;
  sourceMap: SourceMap;
};

export function Report(props: ReportProps) {
  const { data } = props;
  const sourceMap: SourceMap = data.data.reduce(
    (acc, d) => ({ ...acc, [d.id]: d }),
    {} as SourceMap,
  );

  return (
    <>
      <h1 id="title">{data.title}</h1>
      <h1 id="question">{data.question}</h1>
      <div className="report-description">{data.description}</div>
      <Outline {...props} />
      {data.tree.map((topic, i) => (
        <TopicComponent
          i={i}
          key={topic.topicId}
          topic={topic}
          sourceMap={sourceMap}
        />
      ))}
    </>
  );
}

function Outline({ data }: ReportProps) {
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
        <td>{((100 * topic.claimsCount!) / totalClaims).toFixed(0)}%</td>
      </tr>,
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
          <td>{((100 * subtopic.claimsCount!) / totalClaims).toFixed(0)}%</td>
        </tr>,
      );
    });
  });
  return (
    <div id="outline">
      <table>
        <thead>
          <tr>
            <th>Topic/Subtopic</th>
            <th>Claims</th>
            <th>%</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}

function TopicComponent({ topic, i, sourceMap }: TopicProps) {
  return (
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
}

function SubtopicComponent({ subtopic, i, j, sourceMap }: SubtopicProps) {
  return (
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
          <ToggleShowMoreButton subtopic={subtopic} className="showmore-button">
            show all
          </ToggleShowMoreButton>
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
          <ToggleShowMoreButton subtopic={subtopic} className="showless-button">
            show less
          </ToggleShowMoreButton>
        )}
      </ul>
    </div>
  );
}

function ClaimComponent({ claim, sourceMap, more }: ClaimProps) {
  return (
    <li id={claim.claimId} className={more ? "more" : ""}>
      <OpenClaimVideo sourceMap={sourceMap} claim={claim}>
        {claim.claim}{" "}
        {claim.duplicates && claim.duplicates.length
          ? ` (x${1 + claim.duplicates.length})`
          : ""}
      </OpenClaimVideo>
      <ClaimDetailComponent claim={claim} sourceMap={sourceMap} />
    </li>
  );
}

function ClaimDetailComponent({ claim, sourceMap }: ClaimDetailProps) {
  return (
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
}
