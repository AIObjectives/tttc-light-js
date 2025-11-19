import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import CopyButton from "./CopyButton";

const meta = {
  title: "CopyButton",
  component: CopyButton,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],

  //   args: { onClick: fn() },
} satisfies Meta<typeof CopyButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    successMessage: "This is a test",
    copyStr: "Copied this string from CopyButton",
  },
};
