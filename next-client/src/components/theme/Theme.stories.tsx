import type { Meta, StoryObj } from "@storybook/react";
import Theme from "./Theme";

const meta = {
  title: "Theme",
  component: Theme,
  parameters: {
    // layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Theme>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    claim: "Test claim",
    quote:
      "Lorem ipsum dolor sit amet, in eum erat constituam, ius ut justo reformidans deterruisset, accusamus laboramus id duo. Lorem ipsum dolor sit amet, in eum erat constituam, ius ut justo reformidans",
    claimId: "1",
    topicName: "Lorem Ipsum",
    subtopicName: "blah",
    commentId: "1",
  },
};
