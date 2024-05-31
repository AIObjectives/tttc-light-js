import type { Meta, StoryObj } from "@storybook/react";
import Theme, { ThemeGraphic, ThemeHeader, TopicList } from "./Theme";
import { reportData } from "stories/data/dummyData";
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

const baseProps = reportData.themes[0];

export const Main: Story = {
  args: baseProps,
};

const CardWrap = ({ children }: React.PropsWithChildren) => (
  <Card>
    <CardContent>{children}</CardContent>
  </Card>
);

export const Header = () => (
  <div className="border">
    <ThemeHeader title={baseProps.title} />
  </div>
);

export const Graphic = () => (
  <div className="border">
    <ThemeGraphic
      numClaims={baseProps.topics.flatMap((topic) => topic).length}
      numPeople={0}
    />
  </div>
);

export const ListOfTopics = () => (
  <div className="border">
    <TopicList topics={baseProps.topics.map((topic) => topic.title)} />
  </div>
);
