import type { Meta, StoryObj } from "@storybook/react";
import { ElicitationEventDetailView } from "./ElicitationEventDetail";

const meta = {
  title: "Elicitation/ElicitationEventDetail",
  component: ElicitationEventDetailView,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ElicitationEventDetailView>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockEvent = {
  id: "event-123",
  eventName: "Bostonians' view of AI",
  description:
    "A comprehensive study examining how Boston residents perceive and interact with artificial intelligence in their daily lives.",
  startDate: new Date("2024-01-18"),
  endDate: new Date("2024-01-25"),
  createdAt: new Date("2024-01-15"),
  responderCount: 156,
  status: "completed",
  whatsappLink: "lorem-ipsum-wa",
  initialMessage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  questions: [
    "Lorem ipsum",
    "Lorem ipsum",
    "Lorem ipsum",
    "Lorem ipsum",
    "Lorem ipsum",
  ],
  completionMessage: "Lorem ipsum dolor sit...",
  mode: "standard" as const,
  reportId: "report-123", // Legacy field
  reportIds: ["report-123", "report-456", "report-789"], // New array field
};

export const Default: Story = {
  args: {
    event: mockEvent,
  },
};

export const WithFollowUpMode: Story = {
  args: {
    event: {
      ...mockEvent,
      mode: "followup" as const,
    },
  },
};

export const WithoutReport: Story = {
  args: {
    event: {
      ...mockEvent,
      reportId: undefined,
      reportIds: undefined,
    },
  },
};

export const ActiveStatus: Story = {
  args: {
    event: {
      ...mockEvent,
      status: "active",
    },
  },
};

export const MinimalContent: Story = {
  args: {
    event: {
      id: "event-minimal",
      eventName: "Minimal Study",
      responderCount: 50,
      createdAt: new Date("2024-02-01"),
      mode: "standard" as const,
    },
  },
};
