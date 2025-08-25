import type { Meta, StoryObj } from "@storybook/react";
import { reportData } from "../../../stories/data/dummyData";
import Outline from "./Outline";
import { __internals } from "./hooks/useOutlineState";
import { stateBuilder } from "../report/hooks/useReportState/utils";
import { createInitialState } from "./hooks/useOutlineState/utils";
import { ReportContext } from "../report/Report";
import React from "react";

const meta = {
  title: "Outline",
  component: Outline,
  parameters: {
    layout: "center",
  },
  decorators: (Story) => (
    <ReportContext.Provider
      value={{
        setScrollTo: () => ({}),
        dispatch: () => ({}),
        useFocusedNode() {
          return {} as React.Ref<HTMLDivElement>;
        },
        useReportEffect() {},
        useScrollTo() {
          return {} as React.Ref<HTMLDivElement>;
        },
      }}
    >
      <Story />
    </ReportContext.Provider>
  ),
  tags: ["autodocs"],
} satisfies Meta<typeof Outline>;

const reportState = stateBuilder(reportData.topics);
const outlineState = createInitialState(reportState);
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    outlineState,
    reportDispatch: () => {},
    outlineDispatch: () => {},
  },
};
