import type { Meta, StoryObj } from "@storybook/react";
import Topic from "./Topic";
import { taxonomyObject } from "stories/data/dummyData";

const meta = {
  title: "Topic",
  component: Topic,
  parameters: {
    // layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Topic>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: taxonomyObject[0].subtopics[0],
};
