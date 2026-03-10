"use client";

import { Copy, MoreHorizontal, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Spinner,
  TextIcon,
} from "../elements";
import { Center, Col, Row } from "../layout";
import { StudySidebar } from "./StudySidebar";

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

  // Get the most recent report ID for the "Go to report" button.
  // Fall back to the first known report ID from the event if fetched reports haven't loaded.
  const mostRecentReportId = reports[0]?.id ?? reportIdsToFetch?.[0];

  const { events: allEvents } = useElicitationEvents();
  const sidebarStudies = allEvents.map((e) => ({
    id: e.id,
    name: e.eventName,
    month: (e.startDate ?? e.createdAt).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
    participants: e.responderCount,
    expectedParticipants: e.expectedParticipantCount,
  }));

  return (
    <div className="flex h-full bg-slate-50">
      {/* Sidebar */}
      <div className="hidden lg:block flex-shrink-0">
        <StudySidebar studies={sidebarStudies} activeStudyId={event.id} />
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-8 py-8">
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-6 space-y-4">
              <EventHeader
                event={event}
                mostRecentReportId={mostRecentReportId}
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
  );
}

/**
 * Event header with title, date range, status badge, and actions dropdown
 */
function EventHeader({
  event,
  mostRecentReportId,
}: {
  event: ElicitationEventSummary;
  mostRecentReportId?: string;
}) {
  const router = useRouter();
  const { user } = useUserQuery();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const authToken = user ? await user.getIdToken() : undefined;
      const response = await fetchWithRequestId(
        `/api/elicitation/events/${event.id}/generate-report`,
        {
          method: "POST",
          headers: {
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const { reportId } = await response.json();
      router.push(`/report/${reportId}`);
    } catch {
      toast.error("Failed to generate report");
    } finally {
      setIsGenerating(false);
    }
  };

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

      <Row gap={3} className="items-center">
        {event.status && (
          <Badge
            variant="default"
            className="bg-green-100 text-green-800 hover:bg-green-100 rounded-full px-3"
          >
            {getStatusText(event.status)}
          </Badge>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={handleDownload}
              disabled={isDownloading}
            >
              {isDownloading ? "Downloading..." : "Download data"}
            </DropdownMenuItem>
            {mostRecentReportId ? (
              <DropdownMenuItem asChild>
                <Link href={`/report/${mostRecentReportId}`}>Go to report</Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onSelect={handleGenerateReport}
                disabled={isGenerating}
              >
                {isGenerating ? "Generating..." : "Generate report"}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="text-red-400">
              Stop study
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
    <Row gap={0} className="items-center flex-wrap">
      <TextIcon icon={<Icons.People size={16} />}>
        <span className="text-green-700">{event.responderCount}</span>
        <span className="text-slate-600">
          {" "}
          / {event.expectedParticipantCount ?? event.responderCount} participants
        </span>
      </TextIcon>

      {event.mode && (
        <>
          <div className="mx-4 h-4 w-px bg-slate-300" />
          <span className="text-sm text-slate-900">{formatMode(event.mode)}</span>
        </>
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
          <CardContent className="p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-2">
              Opening message
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              {event.initialMessage}
            </p>
          </CardContent>
        </Card>
      )}

      {event.questions && event.questions.length > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-2">
              Survey questions
            </h3>
            <ol className="list-decimal list-inside space-y-1">
              {event.questions.map((question) => (
                <li key={`q-${question.id}`} className="text-sm text-slate-500">
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
            <CardContent className="p-6">
              <h3 className="text-base font-semibold text-slate-900 mb-2">
                Follow-up questions
              </h3>
              <ol className="list-decimal list-inside space-y-1">
                {event.followUpQuestions.questions.map((question, index) => (
                  <li
                    key={`fq-${index}-${question.slice(0, 30)}`}
                    className="text-sm text-slate-500"
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
          <CardContent className="p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-2">
              Closing message
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              {event.completionMessage}
            </p>
          </CardContent>
        </Card>
      )}
    </Col>
  );
}
