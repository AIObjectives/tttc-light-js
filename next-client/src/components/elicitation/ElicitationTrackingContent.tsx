"use client";

import { RefreshCw } from "lucide-react";
import type { ElicitationEventSummary } from "tttc-common/firebase";
import Icons from "@/assets/icons";
import { useElicitationEvents } from "@/lib/hooks/useElicitationEvents";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  Spinner,
  TextIcon,
} from "../elements";
import { Center, Col, Row } from "../layout";

interface ElicitationTrackingContentProps {
  events: ElicitationEventSummary[];
  isLoading?: boolean;
  isError?: boolean;
  error?: Error;
  onRefresh: () => void;
}

/**
 * Presentational component for displaying elicitation events.
 * Use this for testing and Storybook stories.
 */
export function ElicitationTrackingContentView({
  events,
  isLoading = false,
  isError = false,
  error,
  onRefresh,
}: ElicitationTrackingContentProps) {
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
          <AlertTitle>Error Loading Events</AlertTitle>
          <AlertDescription>
            <p className="mb-3">
              {error?.message || "Failed to load elicitation events"}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
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

  return (
    <Col gap={8} className="items-center px-4">
      <ElicitationTrackingHeader onRefresh={onRefresh} />
      {events.length === 0 ? (
        <div className="max-w-[896px] w-full text-center py-12 text-muted-foreground">
          No elicitation events found. Create your first event to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-[896px] w-full">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </Col>
  );
}

/**
 * Container component that fetches data using the useElicitationEvents hook.
 * This is the default export for use in pages.
 */
export default function ElicitationTrackingContent() {
  const { events, isLoading, isError, error, refresh } = useElicitationEvents();

  return (
    <ElicitationTrackingContentView
      events={events}
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRefresh={refresh}
    />
  );
}

interface ElicitationTrackingHeaderProps {
  onRefresh: () => void;
}

function ElicitationTrackingHeader({
  onRefresh,
}: ElicitationTrackingHeaderProps) {
  return (
    <Row
      gap={4}
      className="pt-8 w-full max-w-[896px] justify-between items-center"
    >
      <Col gap={2} className="justify-center">
        <h3>Elicitation Events</h3>
      </Col>
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        aria-label="Refresh events"
      >
        <RefreshCw className="mr-2 h-4 w-4" />
        Refresh
      </Button>
    </Row>
  );
}

interface EventCardProps {
  event: ElicitationEventSummary;
}

export function EventCard({ event }: EventCardProps) {
  const {
    eventName,
    responderCount,
    createdAt,
    mainQuestion,
    initialMessage,
    completionMessage,
  } = event;

  // Format date similar to MyReports component
  const formattedDate = createdAt.toDateString().split(" ").slice(1).join(" ");

  return (
    <Card className="min-w-72 overflow-hidden">
      <CardContent>
        <Col gap={3}>
          <h4 className="line-clamp-1">{eventName}</h4>

          {/* Main Question */}
          {mainQuestion && (
            <div className="text-sm">
              <span className="font-medium text-muted-foreground">
                Main Question:{" "}
              </span>
              <span className="line-clamp-2">{mainQuestion}</span>
            </div>
          )}

          {/* Opening Message */}
          {initialMessage && (
            <div className="text-sm">
              <span className="font-medium text-muted-foreground">
                Opening:{" "}
              </span>
              <span className="line-clamp-2">{initialMessage}</span>
            </div>
          )}

          {/* Closing Message */}
          {completionMessage && (
            <div className="text-sm">
              <span className="font-medium text-muted-foreground">
                Closing:{" "}
              </span>
              <span className="line-clamp-2">{completionMessage}</span>
            </div>
          )}

          {/* Meta info */}
          <Row gap={4} className="flex-wrap pt-2 border-t">
            <TextIcon icon={<Icons.People size={16} />}>
              {responderCount}{" "}
              {responderCount === 1 ? "responder" : "responders"}
            </TextIcon>
            <TextIcon icon={<Icons.Date size={16} />}>{formattedDate}</TextIcon>
          </Row>
        </Col>
      </CardContent>
    </Card>
  );
}
