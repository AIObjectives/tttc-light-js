"use client";

import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import type { CreateElicitationEventRequest } from "tttc-common/api";
import { fetchWithRequestId } from "@/lib/api/fetchWithRequestId";
import { useElicitationEvents } from "@/lib/hooks/useElicitationEvents";
import { useUserQuery } from "@/lib/query/useUserQuery";
import {
  Button,
  Calendar,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  TextArea,
} from "../elements";
import { Col, Row } from "../layout";
import { StudySidebar } from "./StudySidebar";

type ElicitationMode = "listener" | "survey" | "followup";

interface ModeOption {
  value: ElicitationMode;
  label: string;
}

const MODE_OPTIONS: ModeOption[] = [
  { value: "listener", label: "Listening" },
  { value: "survey", label: "Survey" },
  { value: "followup", label: "Follow-up" },
];

function toISODateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Form for creating a new study (elicitation event).
 */
export function CreateStudyForm() {
  const router = useRouter();
  const { user } = useUserQuery();
  const { events: allEvents } = useElicitationEvents();

  const [studyName, setStudyName] = useState("");
  const [location, setLocation] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [expectedRespondents, setExpectedRespondents] = useState("");
  const [mode, setMode] = useState<ElicitationMode>("listener");
  const [initialMessage, setInitialMessage] = useState("");
  const [completionMessage, setCompletionMessage] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dragIndexRef = useRef<number | null>(null);

  const sidebarStudies = allEvents.map((e) => ({
    id: e.id,
    name: e.eventName,
    month: (e.startDate ?? e.createdAt).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
    participants: e.responderCount,
  }));

  const handleAddQuestion = () => {
    const trimmed = newQuestion.trim();
    if (!trimmed) return;
    setQuestions((prev) => [...prev, trimmed]);
    setNewQuestion("");
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!studyName.trim()) {
      toast.error("Study name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const authToken = user ? await user.getIdToken() : undefined;

      const description = location.trim()
        ? `Location: ${location.trim()}`
        : undefined;

      const startDate = dateRange?.from
        ? toISODateString(dateRange.from)
        : undefined;
      const endDate = dateRange?.to ? toISODateString(dateRange.to) : undefined;

      const parsedRespondents = expectedRespondents.trim()
        ? Number(expectedRespondents.trim())
        : undefined;

      const body: CreateElicitationEventRequest = {
        eventName: studyName.trim(),
        description,
        startDate,
        endDate,
        mode,
        initialMessage: initialMessage.trim() || undefined,
        completionMessage: completionMessage.trim() || undefined,
        questions: questions.length > 0 ? questions : undefined,
        expectedParticipantCount:
          parsedRespondents !== undefined && !Number.isNaN(parsedRespondents)
            ? parsedRespondents
            : undefined,
      };

      const response = await fetchWithRequestId("/api/elicitation/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const { event } = await response.json();
      toast.success("Study created successfully");
      router.push(`/elicitation/${event.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create study",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full bg-slate-50">
      {/* Sidebar */}
      <div className="hidden lg:block flex-shrink-0">
        <StudySidebar studies={sidebarStudies} />
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-8 py-8">
          {/* Page header */}
          <Col gap={1} className="mb-6">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">
              Design a study
            </h2>
            <p className="text-base text-muted-foreground">
              Set or edit the parameters of your study. You can edit any study
              up until you launch it.
            </p>
          </Col>

          <Col gap={6}>
            {/* Basic information card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Basic information</CardTitle>
              </CardHeader>
              <CardContent>
                <Col gap={4}>
                  {/* Study Name */}
                  <Col gap={1.5}>
                    <label
                      htmlFor="study-name"
                      className="text-sm font-medium text-foreground"
                    >
                      Study Name
                    </label>
                    <Input
                      id="study-name"
                      placeholder="Unique identifier for your study"
                      value={studyName}
                      onChange={(e) => setStudyName(e.target.value)}
                    />
                  </Col>

                  {/* Location */}
                  <Col gap={1.5}>
                    <label
                      htmlFor="location"
                      className="text-sm font-medium text-foreground"
                    >
                      Location
                    </label>
                    <Input
                      id="location"
                      placeholder="Where will your respondents be?"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </Col>

                  {/* Dates */}
                  <Col gap={1.5}>
                    <p className="text-sm font-medium text-foreground">Dates</p>
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={setDateRange}
                      className="rounded-md border w-fit"
                    />
                  </Col>

                  {/* Expected total respondents */}
                  <Col gap={1.5}>
                    <label
                      htmlFor="expected-respondents"
                      className="text-sm font-medium text-foreground"
                    >
                      Expected total respondents
                    </label>
                    <Input
                      id="expected-respondents"
                      type="number"
                      placeholder="How many respondents do you think will use your tool in total?"
                      value={expectedRespondents}
                      onChange={(e) => setExpectedRespondents(e.target.value)}
                      className="max-w-sm"
                    />
                  </Col>

                  {/* Phone number (informational) */}
                  <Col gap={0.5}>
                    <p className="text-sm font-medium text-foreground">
                      Phone number
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Our default phone number for WhatsApp messages is
                      U.S-based. If you need a different country code, please
                      provide one we can use or reach out to us at
                      t3c@objective.is.
                    </p>
                  </Col>

                  {/* Elicitation mode */}
                  <Col gap={0.5}>
                    <p className="text-sm font-medium text-foreground">
                      Elicitation mode
                    </p>
                    <Row gap={6} className="flex-wrap">
                      {MODE_OPTIONS.map(({ value, label }) => (
                        <label
                          key={value}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="elicitation-mode"
                            value={value}
                            checked={mode === value}
                            onChange={() => setMode(value)}
                            className="accent-primary"
                          />
                          <span className="text-sm text-muted-foreground">
                            {label}
                          </span>
                        </label>
                      ))}
                    </Row>
                  </Col>
                </Col>
              </CardContent>
            </Card>

            {/* Opening message card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Opening message</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Write the instruction or conversational prompt that
                  respondents see first. For example, "Please provide your name
                  and organization to get started" or "Welcome to Summit 2026!
                  What do you think so far?"
                </p>
              </CardHeader>
              <CardContent>
                <TextArea
                  id="initial-message"
                  placeholder="Maximum 2000 characters"
                  value={initialMessage}
                  onChange={(e) => setInitialMessage(e.target.value)}
                  maxLength={2000}
                  rows={5}
                />
              </CardContent>
            </Card>

            {/* Survey questions card */}
            {(mode === "survey" || mode === "followup") && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">Survey questions</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    These are the questions we ask your respondents. If you
                    selected "listening mode" above, you don't need to fill this
                    out; we'll just use the opening prompt you wrote above. If
                    you want to use survey or follow-up mode, add questions
                    here.
                  </p>
                </CardHeader>
                <CardContent>
                  <Col gap={4}>
                    {/* Existing questions */}
                    {questions.length > 0 && (
                      <Col gap={2}>
                        {questions.map((question, index) => (
                          <Row
                            key={`q-${question.slice(0, 20)}-${index}`}
                            gap={3}
                            draggable
                            onDragStart={() => {
                              dragIndexRef.current = index;
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                            }}
                            onDrop={() => {
                              const from = dragIndexRef.current;
                              if (from === null || from === index) return;
                              setQuestions((prev) => {
                                const next = [...prev];
                                const [moved] = next.splice(from, 1);
                                next.splice(index, 0, moved);
                                return next;
                              });
                              dragIndexRef.current = null;
                            }}
                            className="items-center bg-white border border-slate-200 rounded-lg px-3 py-3 cursor-grab active:cursor-grabbing"
                          >
                            <GripVertical className="h-5 w-5 text-slate-400 flex-shrink-0" />
                            <span className="flex-1 text-sm text-slate-600">
                              {question}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveQuestion(index)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
                              aria-label="Remove question"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </Row>
                        ))}
                      </Col>
                    )}

                    {/* Add new question */}
                    <Row gap={2}>
                      <Input
                        placeholder="Enter a new question..."
                        value={newQuestion}
                        onChange={(e) => setNewQuestion(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddQuestion();
                          }
                        }}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        onClick={handleAddQuestion}
                        disabled={!newQuestion.trim()}
                        className="bg-primary text-primary-foreground shrink-0"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </Row>
                  </Col>
                </CardContent>
              </Card>
            )}

            {/* Closing message card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Closing message</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Write the final message respondents see at the end of their
                  interaction. For example, "Thank you for your insights today!
                  Your responses have been recorded."
                </p>
              </CardHeader>
              <CardContent>
                <TextArea
                  id="completion-message"
                  placeholder="Maximum 2000 characters"
                  value={completionMessage}
                  onChange={(e) => setCompletionMessage(e.target.value)}
                  maxLength={2000}
                  rows={5}
                />
              </CardContent>
            </Card>

            {/* Submit button */}
            <div className="flex justify-end pb-8">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !studyName.trim()}
                className="bg-primary text-primary-foreground"
              >
                {isSubmitting ? "Saving..." : "Save study"}
              </Button>
            </div>
          </Col>
        </div>
      </div>
    </div>
  );
}
