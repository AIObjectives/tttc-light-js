import type { Meta, StoryObj } from "@storybook/react";
import Topic, {
  TopicInteractiveGraphic,
  TopicHeader,
  TopicList,
} from "./Topic";
import { reportData } from "stories/data/dummyData";
import { Card, CardContent } from "../elements";
import React from "react";
import CopyLinkButton from "../copyLinkButton/CopyLinkButton";
import { __internals } from "../report/hooks/useReportState";

const { stateBuilder } = __internals;

/**
 * TODO
 * Figure out how to manage state actions here.
 */

const meta = {
  title: "Topic",
  component: Topic,
  parameters: {},
  tags: ["autodocs"],
} satisfies Meta<typeof Topic>;

export default meta;
type Story = StoryObj<typeof meta>;

// const baseProps = reportData.themes[0];
const reportState = stateBuilder(reportData.topics);
const themeNode = reportState.children[0];

export const Main: Story = {
  args: {
    node: themeNode,
  },
};

const CardWrap = ({ children }: React.PropsWithChildren) => (
  <Card>
    <CardContent>{children}</CardContent>
  </Card>
);

export const Header = () => (
  <div className="border">
    <TopicHeader
      title={themeNode.data.title}
      button={<CopyLinkButton anchor={themeNode.data.title} />}
    />
  </div>
);

export const Graphic = () => (
  <div className="border">
    <TopicInteractiveGraphic topics={themeNode.data.subtopics} />
  </div>
);

export const ListOfTopics = () => (
  <div className="border">
    {/* <TopicList topics={baseProps.topics.map((topic) => topic.title)} /> */}
  </div>
);
