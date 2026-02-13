import type { Meta, StoryObj } from "@storybook/react";
import { ElicitationEventDetailView } from "./ElicitationEventDetail";

// Mock fetch for Storybook to simulate report API responses
const mockReportResponses: Record<string, unknown> = {
  "report-123": {
    id: "report-123",
    title: "Initial Analysis Report",
    createdDate: "2024-01-20T10:00:00Z",
    status: "completed",
  },
  "report-456": {
    id: "report-456",
    title: "Follow-up Survey Report",
    createdDate: "2024-02-15T14:30:00Z",
    status: "completed",
  },
  "report-789": {
    id: "report-789",
    title: "Final Insights Report",
    createdDate: "2024-03-10T09:15:00Z",
    status: "completed",
  },
};

const meta = {
  title: "Elicitation/ElicitationEventDetail",
  component: ElicitationEventDetailView,
  parameters: {
    layout: "fullscreen",
    mockData: [
      {
        url: /\/report\/([\w-]+)/,
        method: "GET",
        status: 200,
        response: (request: Request) => {
          const reportId = request.url.match(/\/report\/([\w-]+)/)?.[1];
          return mockReportResponses[reportId || ""] || { error: "Not found" };
        },
      },
    ],
  },
  decorators: [
    (Story) => {
      // Mock global fetch for report requests
      const originalFetch = global.fetch;
      global.fetch = ((url: string | Request | URL, ...args: unknown[]) => {
        const urlString = url.toString();
        const reportMatch = urlString.match(/\/report\/([\w-]+)/);

        if (reportMatch) {
          const reportId = reportMatch[1];
          const mockData = mockReportResponses[reportId];

          if (mockData) {
            return Promise.resolve(
              new Response(JSON.stringify(mockData), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              }),
            );
          }
        }

        return originalFetch(url as RequestInfo, ...(args as RequestInit[]));
      }) as typeof fetch;

      return Story();
    },
  ],
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
