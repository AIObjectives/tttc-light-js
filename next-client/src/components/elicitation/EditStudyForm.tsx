"use client";

import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import type { UpdateElicitationEventRequest } from "tttc-common/api";
import type { ElicitationEventSummary } from "tttc-common/firebase";
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

function toOptionalISODate(date: Date | undefined): string | undefined {
  return date ? toISODateString(date) : undefined;
}

function parseParticipantCount(value: string): number | undefined {
  const parsed = value.trim() ? Number(value.trim()) : undefined;
  return parsed !== undefined && !Number.isNaN(parsed) ? parsed : undefined;
}

interface QuestionsCardProps {
  questions: string[];
  onChange: (questions: string[]) => void;
}

function QuestionsCard({ questions, onChange }: QuestionsCardProps) {
  const [newQuestion, setNewQuestion] = useState("");
  const dragIndexRef = useRef<number | null>(null);

  const handleAdd = () => {
    const trimmed = newQuestion.trim();
    if (!trimmed) return;
    onChange([...questions, trimmed]);
    setNewQuestion("");
  };

  const handleRemove = (index: number) => {
    onChange(questions.filter((_, i) => i !== index));
  };

  const handleDrop = (toIndex: number) => {
    const from = dragIndexRef.current;
    if (from === null || from === toIndex) return;
    const next = [...questions];
    const [moved] = next.splice(from, 1);
    next.splice(toIndex, 0, moved);
    onChange(next);
    dragIndexRef.current = null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Survey questions</CardTitle>
        <p className="text-sm text-muted-foreground">
          These are the questions we ask your respondents. If you selected
          "listening mode" above, you don't need to fill this out; we'll just
          use the opening prompt you wrote above. If you want to use survey or
          follow-up mode, add questions here.
        </p>
      </CardHeader>
      <CardContent>
        <Col gap={4}>
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
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(index)}
                  className="items-center bg-white border border-slate-200 rounded-lg px-3 py-3 cursor-grab active:cursor-grabbing"
                >
                  <GripVertical className="h-5 w-5 text-slate-400 flex-shrink-0" />
                  <span className="flex-1 text-sm text-slate-600">
                    {question}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
                    aria-label="Remove question"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </Row>
              ))}
            </Col>
          )}
          <Row gap={2}>
            <Input
              placeholder="Enter a new question..."
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              className="flex-1"
            />
            <Button
              type="button"
              onClick={handleAdd}
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
  );
}

interface BasicInfo {
  studyName: string;
  location: string;
  dateRange: DateRange | undefined;
  expectedRespondents: string;
  mode: ElicitationMode;
}

interface FormState extends BasicInfo {
  initialMessage: string;
  completionMessage: string;
  questions: string[];
}

function BasicInfoCard({
  value,
  onChange,
}: {
  value: BasicInfo;
  onChange: (updates: Partial<BasicInfo>) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Basic information</CardTitle>
      </CardHeader>
      <CardContent>
        <Col gap={4}>
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
              value={value.studyName}
              onChange={(e) => onChange({ studyName: e.target.value })}
            />
          </Col>
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
              value={value.location}
              onChange={(e) => onChange({ location: e.target.value })}
            />
          </Col>
          <Col gap={1.5}>
            <p className="text-sm font-medium text-foreground">Dates</p>
            <Calendar
              mode="range"
              selected={value.dateRange}
              onSelect={(range) => onChange({ dateRange: range })}
              className="rounded-md border w-fit"
            />
          </Col>
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
              value={value.expectedRespondents}
              onChange={(e) =>
                onChange({ expectedRespondents: e.target.value })
              }
              className="max-w-sm"
            />
          </Col>
          <Col gap={0.5}>
            <p className="text-sm font-medium text-foreground">Phone number</p>
            <p className="text-xs text-muted-foreground">
              Our default phone number for WhatsApp messages is U.S-based. If
              you need a different country code, please provide one we can use
              or reach out to us at t3c@objective.is.
            </p>
          </Col>
          <Col gap={0.5}>
            <p className="text-sm font-medium text-foreground">
              Elicitation mode
            </p>
            <Row gap={6} className="flex-wrap">
              {MODE_OPTIONS.map(({ value: modeValue, label }) => (
                <label
                  key={modeValue}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="elicitation-mode"
                    value={modeValue}
                    checked={value.mode === modeValue}
                    onChange={() => onChange({ mode: modeValue })}
                    className="accent-primary"
                  />
                  <span className="text-sm text-muted-foreground">{label}</span>
                </label>
              ))}
            </Row>
          </Col>
        </Col>
      </CardContent>
    </Card>
  );
}

function OpeningMessageCard({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Opening message</CardTitle>
        <p className="text-sm text-muted-foreground">
          Write the instruction or conversational prompt that respondents see
          first. For example, "Please provide your name and organization to get
          started" or "Welcome to Summit 2026! What do you think so far?"
        </p>
      </CardHeader>
      <CardContent>
        <TextArea
          id="initial-message"
          placeholder="Maximum 2000 characters"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={2000}
          rows={5}
        />
      </CardContent>
    </Card>
  );
}

function ClosingMessageCard({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Closing message</CardTitle>
        <p className="text-sm text-muted-foreground">
          Write the final message respondents see at the end of their
          interaction. For example, "Thank you for your insights today! Your
          responses have been recorded."
        </p>
      </CardHeader>
      <CardContent>
        <TextArea
          id="completion-message"
          placeholder="Maximum 2000 characters"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={2000}
          rows={5}
        />
      </CardContent>
    </Card>
  );
}

function buildRequestBody(form: FormState): UpdateElicitationEventRequest {
  const description = form.location.trim()
    ? `Location: ${form.location.trim()}`
    : undefined;

  return {
    eventName: form.studyName.trim(),
    description,
    startDate: toOptionalISODate(form.dateRange?.from),
    endDate: toOptionalISODate(form.dateRange?.to),
    mode: form.mode,
    initialMessage: form.initialMessage.trim() || undefined,
    completionMessage: form.completionMessage.trim() || undefined,
    questions: form.questions.length > 0 ? form.questions : undefined,
    expectedParticipantCount: parseParticipantCount(form.expectedRespondents),
  };
}

function parseLocation(description: string | undefined): string {
  if (!description) return "";
  const match = description.match(/^Location: (.+)$/);
  return match ? match[1] : "";
}

function initialFormValues(event: ElicitationEventSummary) {
  return {
    studyName: event.eventName,
    location: parseLocation(event.description),
    dateRange:
      event.startDate || event.endDate
        ? ({ from: event.startDate, to: event.endDate } as DateRange)
        : undefined,
    expectedRespondents:
      event.expectedParticipantCount !== undefined
        ? String(event.expectedParticipantCount)
        : "",
    mode: (event.mode as ElicitationMode) ?? "listener",
    initialMessage: event.initialMessage ?? "",
    completionMessage: event.completionMessage ?? "",
    questions: event.questions?.map((q) => q.text) ?? [],
  };
}

function toSidebarStudy(e: ElicitationEventSummary) {
  return {
    id: e.id,
    name: e.eventName,
    month: (e.startDate ?? e.createdAt).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
    participants: e.responderCount,
    expectedParticipants: e.expectedParticipantCount,
  };
}

async function getAuthToken(
  user: { getIdToken: () => Promise<string> } | null | undefined,
): Promise<string | undefined> {
  return user ? user.getIdToken() : undefined;
}

async function patchElicitationEvent(
  eventId: string,
  body: UpdateElicitationEventRequest,
  authToken: string | undefined,
): Promise<void> {
  const response = await fetchWithRequestId(
    `/api/elicitation/events/${eventId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
}

interface EditStudyFormProps {
  event: ElicitationEventSummary;
}

/**
 * Form for editing an existing study (elicitation event) in waiting state.
 */
export function EditStudyForm({ event }: EditStudyFormProps) {
  const router = useRouter();
  const { user } = useUserQuery();
  const { events: allEvents } = useElicitationEvents();

  const initial = initialFormValues(event);
  const [basicInfo, setBasicInfo] = useState<BasicInfo>(initial);
  const [initialMessage, setInitialMessage] = useState(initial.initialMessage);
  const [completionMessage, setCompletionMessage] = useState(
    initial.completionMessage,
  );
  const [questions, setQuestions] = useState<string[]>(initial.questions);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sidebarStudies = allEvents.map(toSidebarStudy);

  const handleSubmit = async () => {
    if (!basicInfo.studyName.trim()) {
      toast.error("Study name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const authToken = await getAuthToken(user);
      const body = buildRequestBody({
        ...basicInfo,
        initialMessage,
        completionMessage,
        questions,
      });
      await patchElicitationEvent(event.id, body, authToken);
      toast.success("Study updated successfully");
      router.push(`/elicitation/${event.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update study",
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
              Edit study
            </h2>
            <p className="text-base text-muted-foreground">
              Set or edit the parameters of your study. You can edit any study
              up until you launch it.
            </p>
          </Col>

          <Col gap={6}>
            <BasicInfoCard
              value={basicInfo}
              onChange={(updates) =>
                setBasicInfo((prev) => ({ ...prev, ...updates }))
              }
            />
            <OpeningMessageCard
              value={initialMessage}
              onChange={setInitialMessage}
            />
            {(basicInfo.mode === "survey" || basicInfo.mode === "followup") && (
              <QuestionsCard questions={questions} onChange={setQuestions} />
            )}
            <ClosingMessageCard
              value={completionMessage}
              onChange={setCompletionMessage}
            />
            <div className="flex justify-end pb-8">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !basicInfo.studyName.trim()}
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
