import React from "react";
import * as schema from "tttc-common/schema";
import CopyLinkButton from "../copyLinkButton/CopyLinkButton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../elements";
import PointGraphic from "../pointGraphic/PointGraphic";
import Claim from "../claim/Claim";

function Topic({
  subtopicName,
  subtopicShortDescription,
  claims,
}: schema.Subtopic) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-y-4">
        <TopicHeader title={subtopicName} numClaims={10} numPeople={10} />
        <PointGraphic num={claims!.length} />
        <p>{subtopicShortDescription}</p>
        <div className="flex flex-col gap-y-6">
          {claims!.map((claim, i) => (
            // ! Something wrong with quotes here
            <Claim
              claimNum={i}
              title={claim.topicName}
              quotes={[claim.quote]}
            />
          ))}
        </div>
      </CardContent>
    </Card>
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
      <CardTitle className="text-xl">{title}</CardTitle>
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
