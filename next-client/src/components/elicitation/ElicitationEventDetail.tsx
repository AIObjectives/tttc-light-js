"use client";

import { Copy, Download, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import type { ElicitationEventSummary } from "tttc-common/firebase";
import Icons from "@/assets/icons";
import { fetchWithRequestId } from "@/lib/api/fetchWithRequestId";
import { useElicitationEvent } from "@/lib/hooks/useElicitationEvent";
import { useElicitationEvents } from "@/lib/hooks/useElicitationEvents";
import { useEventReports } from "@/lib/hooks/useEventReports";
import { useUserQuery } from "@/lib/query/useUserQuery";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Spinner,
  TextIcon,
} from "../elements";
import { Center, Col, Row } from "../layout";
import { StudySidebar } from "./StudySidebar";
import { StudyTimeline } from "./StudyTimeline";

interface ElicitationEventDetailProps {
  eventId: string;
}

/**
 * Container component that fetches and displays a single elicitation event
 */
export default function ElicitationEventDetail({
  eventId,
}: ElicitationEventDetailProps) {
  const { event, isLoading, isError, error, refresh } =
    useElicitationEvent(eventId);

  if (isLoading) {
    return (
      <Center>
        <Spinner />
      </Center>
    );
  }

  if (isError) {
    return (
      <Center>
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle>Error Loading Event</AlertTitle>
          <AlertDescription>
            <p className="mb-3">
              {error?.message || "Failed to load elicitation event"}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refresh()}
              className="mt-2"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </Center>
    );
  }

  if (!event) {
    return (
      <Center>
        <Alert variant="default" className="max-w-md">
          <AlertTitle>Event Not Found</AlertTitle>
          <AlertDescription>
            The requested elicitation event could not be found.
          </AlertDescription>
        </Alert>
      </Center>
    );
  }

  return <ElicitationEventDetailView event={event} />;
}

interface ElicitationEventDetailViewProps {
  event: ElicitationEventSummary;
}

/**
 * Presentational component for displaying event details
 * Use this for testing and Storybook stories
 */
export function ElicitationEventDetailView({
  event,
}: ElicitationEventDetailViewProps) {
  // Fetch all reports associated with this event
  // Handle backward compatibility: use reportIds array if available, otherwise fall back to single reportId
  const reportIdsToFetch =
    event.reportIds || (event.reportId ? [event.reportId] : undefined);
  const { reports } = useEventReports(reportIdsToFetch);

  // Build timeline: start with the event itself, then add reports
  const eventDate = event.startDate || event.createdAt;
  const timelineEvents = [
    // The event itself
    {
      id: event.id,
      name: event.eventName,
      date: eventDate.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      }),
      icon: "study" as const,
      isActive: true,
    },
    // Add all reports
    ...reports.map((report) => ({
      id: report.id,
      name: report.title,
      date: report.createdDate.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      }),
      icon: "document" as const,
      isActive: false,
    })),
  ];

  // Get the most recent report for the "Go to report" button
  const mostRecentReport = reports[0]; // Reports are already sorted by date, newest first

  const { events: allEvents } = useElicitationEvents();
  const sidebarStudies = allEvents.map((e) => ({
    id: e.id,
    name: e.eventName,
    month: (e.startDate ?? e.createdAt).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
    participants: e.responderCount,
  }));

  return (
    <div className="flex h-full bg-slate-50">
      {/* Sidebar */}
      <div className="hidden lg:block flex-shrink-0">
        <StudySidebar studies={sidebarStudies} activeStudyId={event.id} />
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-8">
          {/* Timeline */}
          <div className="sticky top-0 bg-white z-10 border-b border-slate-200 mb-6">
            <StudyTimeline events={timelineEvents} />
          </div>

          {/* Study details */}
          <div className="pb-8">
            <Card className="shadow-lg border-slate-200">
              <CardContent className="p-6 space-y-6">
                <EventHeader
                  event={event}
                  mostRecentReportId={mostRecentReport?.id}
                />
                {event.description && (
                  <EventDescription text={event.description} />
                )}
                <EventMetadata event={event} />
                {event.whatsappLink && (
                  <WhatsAppLinkSection link={event.whatsappLink} />
                )}
                <EventContentSections event={event} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Event header with title, date range, status badge, and action buttons
 */
function EventHeader({
  event,
  mostRecentReportId,
}: {
  event: ElicitationEventSummary;
  mostRecentReportId?: string;
}) {
  const { user } = useUserQuery();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const authToken = user ? await user.getIdToken() : undefined;
      const response = await fetchWithRequestId(
        `/api/elicitation/events/${event.id}/csv`,
        { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${event.eventName
        .replace(/[^a-zA-Z0-9\s-_]/g, "")
        .trim()
        .replace(/\s+/g, "_")}_responses.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download data");
    } finally {
      setIsDownloading(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const dateRange =
    event.startDate && event.endDate
      ? `${formatDate(event.startDate)} - ${formatDate(event.endDate)}`
      : event.createdAt
        ? formatDate(event.createdAt)
        : "No date available";

  const getStatusText = (status?: string) => {
    if (!status) return null;
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <Row gap={4} className="justify-between items-start flex-wrap">
      <Col gap={1}>
        <h1 className="text-xl font-semibold text-slate-900">
          {event.eventName}
        </h1>
        <p className="text-sm text-slate-500">{dateRange}</p>
      </Col>

      <Row gap={3} className="items-center flex-wrap">
        {event.status && (
          <Badge
            variant="default"
            className="bg-green-100 text-green-800 hover:bg-green-100 rounded-full px-3"
          >
            {getStatusText(event.status)}
          </Badge>
        )}
        <Button
          variant="outline"
          size="sm"
          className="bg-indigo-50 text-indigo-700 border-indigo-50 hover:bg-indigo-100"
          onClick={handleDownload}
          disabled={isDownloading}
        >
          <Download className="mr-2 h-4 w-4" />
          {isDownloading ? "Downloading..." : "Download data"}
        </Button>
        {mostRecentReportId ? (
          <Link href={`/report/${mostRecentReportId}`}>
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Go to report
            </Button>
          </Link>
        ) : (
          <Button
            size="sm"
            disabled
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            Go to report
          </Button>
        )}
      </Row>
    </Row>
  );
}

/**
 * Event description text
 */
function EventDescription({ text }: { text: string }) {
  return <p className="text-base text-slate-700 leading-relaxed">{text}</p>;
}

/**
 * Event metadata: participant count and mode
 */
function EventMetadata({ event }: { event: ElicitationEventSummary }) {
  const formatMode = (mode?: string) => {
    if (!mode) return null;
    return mode.charAt(0).toUpperCase() + mode.slice(1);
  };

  return (
    <Row gap={6} className="items-center flex-wrap">
      <TextIcon icon={<Icons.People size={16} />}>
        <span className="text-green-700">{event.responderCount}</span>
        <span className="text-slate-600">
          {" "}
          / {event.responderCount} participants
        </span>
      </TextIcon>

      {event.mode && (
        <span className="text-sm text-slate-900">{formatMode(event.mode)}</span>
      )}
    </Row>
  );
}

/**
 * WhatsApp link with copy-to-clipboard functionality
 */
function WhatsAppLinkSection({ link }: { link: string }) {
  const [isCopied, setIsCopied] = useState(false);

  const copyWhatsAppLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setIsCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <Row gap={2} className="items-center">
      <p className="text-base text-slate-700">
        Whatsapp link: <span className="text-indigo-600">{link}</span>
      </p>
      <button
        type="button"
        onClick={copyWhatsAppLink}
        className="p-1 hover:bg-slate-100 rounded"
        aria-label="Copy WhatsApp link"
      >
        <Copy className="w-4 h-4 text-slate-500" />
      </button>
      {isCopied && <span className="text-xs text-green-600">Copied!</span>}
    </Row>
  );
}

/**
 * Content sections: opening message, survey questions, follow-up questions, closing message
 */
function EventContentSections({ event }: { event: ElicitationEventSummary }) {
  const hasContent =
    event.initialMessage ||
    (event.questions && event.questions.length > 0) ||
    (event.followUpQuestions?.enabled &&
      event.followUpQuestions.questions.length > 0) ||
    event.completionMessage;

  if (!hasContent) {
    return null;
  }

  return (
    <Col gap={4} className="mt-4">
      {event.initialMessage && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">
              Opening message
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 leading-relaxed">
              {event.initialMessage}
            </p>
          </CardContent>
        </Card>
      )}

      {event.questions && event.questions.length > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">
              Survey questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2">
              {event.questions.map((question) => (
                <li key={`q-${question.id}`} className="text-sm text-slate-600">
                  {question.text}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {event.followUpQuestions?.enabled &&
        event.followUpQuestions.questions.length > 0 && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold">
                Follow-up questions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-2">
                {event.followUpQuestions.questions.map((question, index) => (
                  <li
                    key={`fq-${index}-${question.slice(0, 30)}`}
                    className="text-sm text-slate-600"
                  >
                    {question}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}

      {event.completionMessage && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">
              Closing message
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 leading-relaxed">
              {event.completionMessage}
            </p>
          </CardContent>
        </Card>
      )}
    </Col>
  );
}
