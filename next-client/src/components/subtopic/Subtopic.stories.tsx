import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import Subtopic from "./Subtopic";
import { reportData } from "../../../stories/data/dummyData";
import { stateBuilder } from "../report/hooks/useReportState/utils";

const reportState = stateBuilder(reportData.topics);
const subtopicNode = reportState.children[0].children[0];

/**
 * ! This story will be broken until the component is refactored
 */

const meta = {
  title: "Subtopic",
  component: Subtopic,
  parameters: {},
  tags: ["autodocs"],
  decorators: [(Story) => <div className="border">{/* <Story /> */}</div>],
} satisfies Meta<typeof Subtopic>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Main: Story = {
  args: { node: subtopicNode, isOpen: true },
};
