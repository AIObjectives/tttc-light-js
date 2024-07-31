import type { Meta, StoryObj } from "@storybook/react";
import { reportData } from "stories/data/dummyData";
import React, { useRef, useState } from "react";
import { Button } from "../elements";
import { Col, Row } from "../layout";
import Outline from "./Outline";
import { __internals as __internals_report } from "../report/hooks/useReportState";
import { __internals } from "./hooks/useOutlineState";

const { stateBuilder } = __internals_report;
const { outlineStateBuilder } = __internals;

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

const reportState = stateBuilder(reportData.themes);
export default meta;
type Story = StoryObj<typeof meta>;

export const Main: Story = {
  args: {
    nodes: reportState.children,
    reportDispatch: () => {},
  },
};
