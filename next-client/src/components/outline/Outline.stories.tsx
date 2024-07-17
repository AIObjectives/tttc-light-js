import type { Meta, StoryObj } from "@storybook/react";
import { reportData } from "stories/data/dummyData";
import React, { useRef, useState } from "react";
import { Button } from "../elements";
import { Col, Row } from "../layout";
import Outline from "./Outline";

const meta = {
  title: "Outline",
  component: Outline,
  parameters: {
    layout: "center",
  },
  tags: ["autodocs"],
  //   decorators: [
  //     (Story) => (
  //       <div className="flex h-screen border items-center justify-center">
  //         <Story />
  //       </div>
  //     ),
  //   ],
} satisfies Meta<typeof Outline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Main: Story = {
  args: {
    themes: [...reportData.themes, ...reportData.themes],
  },
};
