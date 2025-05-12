import type { Meta, StoryObj } from "@storybook/react";
import { reportData } from "../../../stories/data/dummyData";
import Outline from "./Outline";
import { __internals } from "./hooks/useOutlineState";
import { stateBuilder } from "../report/hooks/useReportState/utils";

const meta = {
  title: "Outline",
  component: Outline,
  parameters: {
    layout: "center",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Outline>;

const reportState = stateBuilder(reportData.topics);
export default meta;
type Story = StoryObj<typeof meta>;

export const Main: Story = {
  args: {
    reportState: { children: reportState.children, focusedId: "", error: null },
    reportDispatch: () => {},
  },
};
