import React from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "../elements";
import * as schema from "tttc-common/schema";
import CopyLinkButton from "../copyLinkButton/CopyLinkButton";
import PointGraphic from "../pointGraphic/PointGraphic";

function Theme(props: schema.Claim) {
  return (
    <Card className="">
      <CardContent className="flex flex-col gap-y-3">
        <ThemeHeader title={props.topicName} />
        <ThemeGraphic numClaims={243} numPeople={48} />
        <text>{props.quote}</text>
        <TopicList
          topics={[
            "Dolor simet apsus sit",
            "Dolor simet apsus sit",
            "Dolor simet apsus sit",
            "Dolor simet apsus sit",
            "Dolor simet apsus sit",
            "Dolor simet apsus sit",
            "Dolor simet apsus sit",
          ]}
        />
        <div>
          <Button>Expand Theme</Button>
        </div>
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
      <CardDescription>
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
        <text className="text-sm text-muted-foreground">
          {topics.length} topics
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
