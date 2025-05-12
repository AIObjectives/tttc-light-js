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

const reportState = stateBuilder(reportData.topics);
const themeNode = reportState.children[0];

export const Main: Story = {
  args: {
    node: themeNode,
  },
};
