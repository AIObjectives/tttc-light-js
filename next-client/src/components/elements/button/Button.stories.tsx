import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { Button } from "./Button";
import "../../../app/global.css";

const meta = {
  title: "Button",
  component: Button,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],

  args: { onClick: fn() },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

type Sizes = "lg" | "default" | "sm";
const sizes: Sizes[] = ["lg", "default", "sm"];

const enummerateButtonSizes = (story: Story) =>
  sizes.map((size) => <Button {...story.args} size={size} className="mx-2" />);

export const Primary: Story = {
  args: {
    children: "Primary",
    variant: "default",
  },
};

Primary.decorators = [() => <>{enummerateButtonSizes(Primary)}</>];

export const Secondary: Story = {
  args: {
    children: "Secondary",
    variant: "secondary",
  },
};

Secondary.decorators = [() => <>{enummerateButtonSizes(Secondary)}</>];

export const Outline: Story = {
  args: {
    children: "Outline",
    variant: "outline",
  },
};

Outline.decorators = [() => <>{enummerateButtonSizes(Outline)}</>];

export const Ghost: Story = {
  args: {
    children: "Ghost",
    variant: "ghost",
  },
};

Ghost.decorators = [() => <>{enummerateButtonSizes(Ghost)}</>];

export const Link: Story = {
  args: {
    children: "Link",
    variant: "link",
  },
};

Link.decorators = [() => <>{enummerateButtonSizes(Link)}</>];
