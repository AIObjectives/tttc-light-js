import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import CopyLinkButton from "./CopyLinkButton";

const meta = {
  title: "CopyLinkButton",
  component: CopyLinkButton,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],

  //   args: { onClick: fn() },
} satisfies Meta<typeof CopyLinkButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    anchor: "This is a test",
  },
};
