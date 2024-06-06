import type { Meta, StoryObj } from "@storybook/react";
import Navbar from "./Navbar";

const meta = {
  title: "Navbar",
  component: Navbar,
  parameters: {
    // layout: "centered",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Navbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Main: Story = {
  args: {},
};
