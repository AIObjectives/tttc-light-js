import type { Meta, StoryObj } from "@storybook/react";
import Topic from "./Topic";
import { reportData } from "../../../stories/data/dummyData";
import { stateBuilder } from "../report/hooks/useReportState/utils";

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

// Limit data for Storybook to avoid 30-second timeout with massive hidden DOM.
// Large report testing is done manually outside CI - see test-csv-examples/
const limitedTopics = reportData.topics.map((topic) => ({
  ...topic,
  subtopics: topic.subtopics.slice(0, 2).map((subtopic) => ({
    ...subtopic,
    claims: subtopic.claims.slice(0, 3),
  })),
}));

const reportState = stateBuilder(limitedTopics);
const themeNode = reportState.children[0];

export const Main: Story = {
  args: {
    node: themeNode,
  },
};
