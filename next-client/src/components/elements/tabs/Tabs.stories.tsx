import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { Tabs, TabsList, TabsTrigger } from "./Tabs";
import "../../../app/global.css";

function TabsStory() {
  return (
    <Tabs>
      <TabsList>
        <TabsTrigger value="test1">Test1</TabsTrigger>
        <TabsTrigger value="test2">Test2</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

const meta = {
  title: "Tabs",
  component: TabsStory,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],

  args: { onClick: fn() },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
