import React from "react";
import { Button, Card, CardContent, CardTitle } from "../elements";
import * as schema from "tttc-common/schema";
import CopyLinkButton from "../copyLinkButton/CopyLinkButton";

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
      <CardTitle>
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
      <ThemeSubInfo numClaims={numClaims} numPeople={numPeople} />
      <ThemeUnitList num={numClaims} />
    </div>
  );
}

function ThemeSubInfo({
  numClaims,
  numPeople,
}: {
  numClaims: number;
  numPeople: number;
}) {
  return (
    <div>
      <text className="text-muted-foreground text-sm">
        {numClaims} claims by {numPeople} people
      </text>
    </div>
  );
}

function ThemeUnitList({ num }: { num: number }) {
  return (
    <div className="flex flex-row w-full flex-wrap gap-px">
      {[...Array(num)].map((_) => (
        <ThemeUnit />
      ))}
    </div>
  );
}

function ThemeUnit() {
  return <div className="w-3 h-3 bg-slate-200 rounded-sm" />;
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
