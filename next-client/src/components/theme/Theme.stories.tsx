import type { Meta, StoryObj } from "@storybook/react";
import Topic from "./Theme";

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
  args: {
    claim: "Test claim",
    quote: "Here's a quote",
    claimId: "1",
    topicName: "Test claim title",
    subtopicName: "blah",
    commentId: "1",
  },
};
