import type { Meta, StoryObj } from "@storybook/react";
import { ElicitationNoAccess } from "./ElicitationNoAccess";

const meta = {
  title: "Elicitation/ElicitationNoAccess",
  component: ElicitationNoAccess,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ElicitationNoAccess>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
