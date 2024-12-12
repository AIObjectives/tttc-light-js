import type { Meta, StoryObj } from "@storybook/react";
import { ToggleText } from "./ToggleText";

const ShowToggleText = () => {
  return (
    <ToggleText>
      <ToggleText.Title>{"Toggle Text Title"}</ToggleText.Title>
      <ToggleText.Content>{"Toggle Text Content"}</ToggleText.Content>
    </ToggleText>
  );
};

const meta = {
  title: "ToggleText",
  component: ShowToggleText,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Report>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Main: Story = {
  args: undefined,
};
