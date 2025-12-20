import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { Col } from "@/components/layout";

function Typography() {
  return (
    <Col gap={5}>
      <h1>h1 - The quick brown fox jumps over the lazy dog</h1>
      <h2>h2 - The quick brown fox jumps over the lazy dog</h2>
      <h3>h3 - The quick brown fox jumps over the lazy dog</h3>
      <h4>h1 - The quick brown fox jumps over the lazy dog</h4>
      <p>p - The quick brown fox jumps over the lazy dog</p>
      <p className="p-medium">
        p-medium - The quick brown fox jumps over the lazy dog
      </p>
      <p className="p2">p2 - The quick brown fox jumps over the lazy dog</p>
      <p className="p2-medium">
        p2-medium - The quick brown fox jumps over the lazy dog
      </p>
      <details>detail - The quick brown fox jumps over the lazy dog</details>
    </Col>
  );
}

const meta = {
  title: "Typography",
  component: Typography,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],

  args: { onClick: fn() },
} satisfies Meta<typeof Typography>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {},
};
