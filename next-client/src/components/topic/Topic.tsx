import React from "react";
import { Button, Card, CardContent, CardTitle } from "../elements";
import * as schema from "tttc-common/schema";

function Topic(props: schema.Claim) {
  return (
    <Card className=" dark:bg-black">
      <CardContent className="flex flex-col gap-y-3">
        <TopicHeader title={props.topicName} numClaims={100} numPeople={200} />
        <TopicUnitList num={100} />
        <text>{props.quote}</text>
        <TopicList topics={["topic1", "topic2"]} />
        <div>
          <Button>Expand topic</Button>
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
    <div className="flex justify-between">
      {/* <h1 className={"text-2xl font-bold"}>{title}</h1> */}
      <CardTitle>{title}</CardTitle>
      <div className="self-center">
        <text className="text-sm text-muted-foreground mr-2">
          {numClaims} claims
        </text>
        <text className="text-sm text-muted-foreground">
          {numPeople} people
        </text>
      </div>
    </div>
  );
}

function TopicUnitList({ num }: { num: number }) {
  return (
    <div className="flex flex-row w-full flex-wrap gap-px">
      {[...Array(num)].map((_) => (
        <TopicUnit />
      ))}
    </div>
  );
}

function TopicUnit() {
  return <div className="w-3 h-3 bg-slate-200 rounded-sm" />;
}

function TopicList({ topics }: { topics: string[] }) {
  return (
    <div>
      <text className="text-sm text-muted-foreground">
        {topics.length} topics:{" "}
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
  );
}

export default Topic;
