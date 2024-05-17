import React from "react";
import { Button, Card, CardContent, CardTitle } from "../elements";
import * as schema from "tttc-common/schema";

function Theme(props: schema.Claim) {
  return (
    <Card className=" dark:bg-black">
      <CardContent className="flex flex-col gap-y-3">
        <ThemeHeader title={props.topicName} numClaims={100} numPeople={200} />
        <ThemeUnitList num={100} />
        <text>{props.quote}</text>
        <ThemeList themes={["theme1", "theme2"]} />
        <div>
          <Button>Expand Theme</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ThemeHeader({
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

function ThemeList({ themes }: { themes: string[] }) {
  return (
    <div>
      <text className="text-sm text-muted-foreground">
        {themes.length} Themes:{" "}
        {themes.map((theme, i) => (
          <span>
            <span className="underline">
              {theme}
              {i !== themes.length - 1 ? "," : ""}
            </span>{" "}
          </span>
        ))}
      </text>
    </div>
  );
}

export default Theme;
