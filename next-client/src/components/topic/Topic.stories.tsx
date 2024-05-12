import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import Topic from "./Topic";
// import "../../app/global.css";

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
    // children: "Button",
    // variant: "default",
  },
};
