import type { Meta, StoryObj } from "@storybook/react";
import Theme, { ThemeGraphic, ThemeHeader, TopicList } from "./Theme";
import { taxonomyObject } from "stories/data/dummyData";
import { Card, CardContent } from "../elements";
import React from "react";

const meta = {
  title: "Theme",
  component: Theme,
  parameters: {},
  tags: ["autodocs"],
} satisfies Meta<typeof Theme>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseProps = taxonomyObject[0];

export const Main: Story = {
  args: taxonomyObject[0],
};

const CardWrap = ({ children }: React.PropsWithChildren) => (
  <Card>
    <CardContent>{children}</CardContent>
  </Card>
);

export const Header = () => (
  <div className="border">
    <ThemeHeader title={baseProps.topicName} />
  </div>
);

export const Graphic = () => (
  <div className="border">
    <ThemeGraphic
      numClaims={baseProps.claimsCount!}
      numPeople={baseProps.subtopics.length}
    />
  </div>
);

export const ListOfTopics = () => (
  <div className="border">
    <TopicList
      topics={baseProps.subtopics.map((subtopic) => subtopic.subtopicName)}
    />
  </div>
);
