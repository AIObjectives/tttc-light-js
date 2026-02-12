import type { Meta, StoryObj } from "@storybook/react";
import type { ElicitationEventSummary } from "tttc-common/firebase";
import {
  ElicitationTrackingContentView,
  EventCard,
} from "./ElicitationTrackingContent";

const meta = {
  title: "Elicitation/ElicitationTrackingContent",
  component: ElicitationTrackingContentView,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ElicitationTrackingContentView>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock event data
const mockEvents: ElicitationEventSummary[] = [
  {
    id: "event-1",
    eventName: "AI Safety Conference Discussion",
    ownerUserId: "user-123",
    responderCount: 42,
    createdAt: new Date("2026-02-10T10:00:00Z"),
    mainQuestion:
      "What are your thoughts on AI safety measures and regulations?",
    initialMessage:
      "Thank you for participating. Your responses will help shape future AI policy.",
    completionMessage:
      "Thank you for sharing your insights. Your input is valuable to this discussion.",
  },
  {
    id: "event-2",
    eventName: "Climate Policy Workshop",
    ownerUserId: "user-123",
    responderCount: 18,
    createdAt: new Date("2026-02-08T14:30:00Z"),
    mainQuestion: "How should we address climate change at the local level?",
    initialMessage: "Welcome to the climate policy discussion.",
    completionMessage: "We appreciate your time and thoughtful responses.",
  },
  {
    id: "event-3",
    eventName:
      "Healthcare Reform Elicitation Session with a Very Long Title That Should Be Truncated",
    ownerUserId: "user-123",
    responderCount: 1,
    createdAt: new Date("2026-02-05T09:15:00Z"),
    mainQuestion:
      "What improvements would you like to see in the healthcare system, and what specific challenges have you or your family faced when accessing healthcare services?",
    initialMessage:
      "Your voice matters in shaping healthcare policy. All responses are confidential and will be used to inform policy decisions.",
    completionMessage:
      "Thank you for sharing your healthcare experiences. Your input helps us understand the real-world impact of policy decisions.",
  },
  {
    id: "event-4",
    eventName: "Education Technology Survey",
    ownerUserId: "user-123",
    responderCount: 156,
    createdAt: new Date("2026-01-28T16:45:00Z"),
    mainQuestion: "How has technology impacted your educational experience?",
  },
];

// Story: With Events
export const WithEvents: Story = {
  args: {
    events: mockEvents,
    isLoading: false,
    isError: false,
    onRefresh: () => console.log("Refresh clicked"),
  },
};

// Story: Loading State
export const Loading: Story = {
  args: {
    events: [],
    isLoading: true,
    isError: false,
    onRefresh: () => console.log("Refresh clicked"),
  },
};

// Story: Error State
export const ErrorState: Story = {
  args: {
    events: [],
    isLoading: false,
    isError: true,
    error: new Error("Failed to fetch elicitation events. Please try again."),
    onRefresh: () => console.log("Retry clicked"),
  },
};

// Story: Empty State
export const Empty: Story = {
  args: {
    events: [],
    isLoading: false,
    isError: false,
    onRefresh: () => console.log("Refresh clicked"),
  },
};

// Story: Single Event
export const SingleEvent: Story = {
  args: {
    events: [mockEvents[0]],
    isLoading: false,
    isError: false,
    onRefresh: () => console.log("Refresh clicked"),
  },
};

// Story: Many Events (to show grid layout)
export const ManyEvents: Story = {
  args: {
    events: [
      ...mockEvents,
      {
        id: "event-5",
        eventName: "Urban Planning Community Input",
        ownerUserId: "user-123",
        responderCount: 89,
        createdAt: new Date("2026-01-20T11:00:00Z"),
      },
      {
        id: "event-6",
        eventName: "Budget Priorities Survey",
        ownerUserId: "user-123",
        responderCount: 234,
        createdAt: new Date("2026-01-15T13:30:00Z"),
      },
    ],
    isLoading: false,
    isError: false,
    onRefresh: () => console.log("Refresh clicked"),
  },
};

// Story: Single Event Card
export const SingleCard = () => <EventCard event={mockEvents[0]} />;

// Story: Card with Long Title
export const CardWithLongTitle = () => <EventCard event={mockEvents[2]} />;
