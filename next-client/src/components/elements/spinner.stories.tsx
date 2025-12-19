import type { Meta, StoryObj } from "@storybook/react";
import { Spinner } from "./spinner";

const meta = {
  title: "Spinner",
  component: Spinner,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Sizes: Story = {
  decorators: [
    () => (
      <div className="flex items-center gap-4">
        <Spinner className="size-4" />
        <Spinner className="size-6" />
        <Spinner className="size-8" />
        <Spinner className="size-12" />
      </div>
    ),
  ],
};

export const WithLabel: Story = {
  args: {
    label: "Processing your request...",
  },
};

export const InButton: Story = {
  decorators: [
    () => (
      <button
        type="button"
        disabled
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground opacity-70"
      >
        <Spinner className="size-4" />
        Loading...
      </button>
    ),
  ],
};
