import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import Icons from "@/assets/icons";
import { Button } from "./Button";

/**
 * NOTES:
 * TODO: Add spinner to disabled??
 * TODO: Icon + Text Story
 */

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

export const Destructive: Story = {
  args: {
    children: "Destructive",
    variant: "destructive",
  },
};

Destructive.decorators = [() => <>{enummerateButtonSizes(Destructive)}</>];

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

export const Icon: Story = {
  args: {
    children: <Icons.Plus size={16} />,
    size: "icon",
    variant: "outline",
  },
};

Icon.decorators = [
  () => (
    <>
      <Button {...Icon.args} className="mr-5" />
      <Button {...Icon.args} className="rounded-full" />
    </>
  ),
];

export const Disabled: Story = {
  args: {
    children: "Loading",
    size: "default",
    disabled: true,
  },
};
