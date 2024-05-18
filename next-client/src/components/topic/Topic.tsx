import React from "react";
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
  title,
  description,
  claims,
}: {
  title: string;
  description: string;
  claims: { title: string; quotes: string[] }[];
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-y-4">
        <TopicHeader title={title} numClaims={10} numPeople={10} />
        <PointGraphic num={claims.length} />
        <p>{description}</p>
        <div className="flex flex-col gap-y-6">
          {claims.map((claim, i) => (
            <Claim claimNum={i} title={claim.title} quotes={claim.quotes} />
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
