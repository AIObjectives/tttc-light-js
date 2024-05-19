import React from "react";
import * as schema from "tttc-common/schema";
import CopyLinkButton from "../copyLinkButton/CopyLinkButton";
import { CardDescription } from "../elements";
import PointGraphic from "../pointGraphic/PointGraphic";
import Claim from "../claim/Claim";

function Topic({ subtopic }: { subtopic: schema.Subtopic }) {
  const { subtopicName, claims, claimsCount, subtopicShortDescription } =
    subtopic;
  return (
    <div className="flex flex-col gap-y-4">
      <TopicHeader
        title={subtopicName}
        numClaims={claimsCount!}
        numPeople={claims!.length}
      />
      <PointGraphic num={claims!.length} />
      <p>{subtopicShortDescription}</p>
      <div className="flex flex-col gap-y-6">
        {claims!.map((claim, i) => (
          // ! Something wrong with quotes here
          <Claim claimNum={i} title={claim.topicName} quotes={[claim.quote]} />
        ))}
      </div>
    </div>
  );
}

function TopicHeader({
  title,
  numClaims,
  numPeople,
}: {
  title: string;
  numClaims: number;
  numPeople: number;
}) {
  return (
    <div className="flex flex-row justify-between items-center">
      <h3 className="text-xl font-semibold">{title}</h3>
      <div className="flex flex-row">
        <CardDescription className="self-center mr-4">
          {numClaims} claims by {numPeople} people
        </CardDescription>
        <CopyLinkButton anchor={title} />
      </div>
    </div>
  );
}

export default Topic;
