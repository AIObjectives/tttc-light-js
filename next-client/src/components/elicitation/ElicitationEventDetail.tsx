"use client";

import { Copy, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import type { ElicitationEventSummary } from "tttc-common/firebase";
import Icons from "@/assets/icons";
import { useElicitationEvent } from "@/lib/hooks/useElicitationEvent";
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
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6">
      <Card className="shadow-lg">
        <CardContent className="p-6">
          <Col gap={4}>
            <EventHeader event={event} />
            {event.description && <EventDescription text={event.description} />}
            <EventMetadata event={event} />
            {event.whatsappLink && (
              <WhatsAppLinkSection link={event.whatsappLink} />
            )}
            <EventContentSections event={event} />
          </Col>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Event header with title, date range, status badge, and action buttons
 */
function EventHeader({ event }: { event: ElicitationEventSummary }) {
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

  const getStatusVariant = (
    status?: string,
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "completed":
        return "default";
      case "active":
        return "secondary";
      case "draft":
        return "outline";
      case "archived":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getStatusText = (status?: string) => {
    if (!status) return null;
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <Row gap={4} className="justify-between items-start flex-wrap">
      <Col gap={1}>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          {event.eventName}
        </h1>
        <p className="text-sm text-slate-500">{dateRange}</p>
      </Col>

      <Row gap={3} className="items-center flex-wrap">
        {event.status && (
          <Badge
            variant={getStatusVariant(event.status)}
            className="bg-green-100 text-green-800 hover:bg-green-100"
          >
            {getStatusText(event.status)}
          </Badge>
        )}
        <Button variant="outline" size="sm">
          Download data
        </Button>
        {event.reportId ? (
          <Link href={`/report/${event.reportId}`}>
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
              Go to report
            </Button>
          </Link>
        ) : (
          <Button
            size="sm"
            disabled
            className="bg-purple-600 hover:bg-purple-700"
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
 * Event metadata: participant count and follow-up mode indicator
 */
function EventMetadata({ event }: { event: ElicitationEventSummary }) {
  return (
    <Row gap={6} className="items-center flex-wrap">
      <TextIcon icon={<Icons.People size={16} />}>
        <span className="text-green-700">{event.responderCount}</span>
        <span className="text-slate-600">
          {" "}
          / {event.responderCount} participants
        </span>
      </TextIcon>

      {event.mode === "followup" && (
        <Row gap={2} className="items-center">
          <div className="w-4 h-4 border-2 border-indigo-600 rounded" />
          <span className="text-sm text-slate-900">Follow-up mode</span>
        </Row>
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
 * Content sections: opening message, survey questions, closing message
 */
function EventContentSections({ event }: { event: ElicitationEventSummary }) {
  const hasContent =
    event.initialMessage ||
    (event.questions && event.questions.length > 0) ||
    event.completionMessage;

  if (!hasContent) {
    return null;
  }

  return (
    <Col gap={4} className="mt-4">
      {event.initialMessage && (
        <Card>
          <CardHeader>
            <CardTitle>Opening message</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">{event.initialMessage}</p>
          </CardContent>
        </Card>
      )}

      {event.questions && event.questions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Survey questions</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2">
              {event.questions.map((question, index) => (
                <li
                  key={`q-${index}-${question.slice(0, 30)}`}
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
        <Card>
          <CardHeader>
            <CardTitle>Closing message</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">{event.completionMessage}</p>
          </CardContent>
        </Card>
      )}
    </Col>
  );
}
