import React from "react";
import { Card, CardContent, CardDescription, CardTitle } from "../elements";
import * as schema from "tttc-common/schema";
import CopyLinkButton from "../copyLinkButton/CopyLinkButton";
import PointGraphic from "../pointGraphic/PointGraphic";
import DisplayExtendedTheme from "./components/ExtendedTheme";
import Icons from "@src/assets/icons";

/**
 * Notes:
 * ! how do we do num claims and people??
 */

function Theme(props: schema.Topic) {
  return (
    <Card className="">
      <CardContent className="flex flex-col gap-y-3">
        <ThemeHeader title={props.topicName} />
        <ThemeGraphic
          numClaims={props.claimsCount!}
          numPeople={props.subtopics.length}
        />
        <text>{props.topicShortDescription}</text>
        <TopicList
          topics={props.subtopics.map((subtopic) => subtopic.subtopicName)}
        />
        <DisplayExtendedTheme subtopics={props.subtopics} />
      </CardContent>
    </Card>
  );
}

function ThemeHeader({ title }: { title: string }) {
  return (
    <div className="flex justify-between">
      <CardTitle className="self-center">
        <a id={`${title}`}>{title}</a>
      </CardTitle>
      <CopyLinkButton anchor={title} />
    </div>
  );
}

function ThemeGraphic({
  numClaims,
  numPeople,
}: {
  numClaims: number;
  numPeople: number;
}) {
  return (
    <div className="flex flex-col gap-y-2">
      <CardDescription className="flex flex-row">
        <Icons.Claim />
        {numClaims} claims by {numPeople} people
      </CardDescription>
      <PointGraphic num={numClaims} />
    </div>
  );
}

function TopicList({ topics }: { topics: string[] }) {
  return (
    <div className="flex flex-col gap-y-2">
      <div>
        <text className="flex flex-row text-sm text-muted-foreground">
          <Icons.Topic /> {topics.length} topics
        </text>
      </div>
      <div>
        <text className="text-sm text-muted-foreground">
          {topics.map((topic, i) => (
            <span>
              <span className="underline">
                {topic}
                {i !== topics.length - 1 ? "," : ""}
              </span>{" "}
            </span>
          ))}
        </text>
      </div>
    </div>
  );
}

export default Theme;
