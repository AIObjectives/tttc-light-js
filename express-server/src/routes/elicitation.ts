import type { Response } from "express";
import { FieldValue } from "firebase-admin/firestore";
import * as api from "tttc-common/api";
import { ERROR_CODES } from "tttc-common/errors";
import type { ElicitationEventSummary } from "tttc-common/firebase";
import { logger } from "tttc-common/logger";
import { isEventOrganizer } from "tttc-common/permissions";
import * as prompts from "tttc-common/prompts";
import type * as schema from "tttc-common/schema";
import { db, getCollectionName } from "../Firebase";
import { isFeatureEnabled } from "../featureFlags";
import { FEATURE_FLAGS } from "../featureFlags/constants";
import { createStorage } from "../storage";
import type { RequestWithAuth } from "../types/request";
import {
  addAnonymousNames,
  buildPipelineJob,
  createAndSaveReport,
  createUserDocuments,
  selectQueue,
} from "./create";
import { sendErrorByCode } from "./sendError";

const elicitationLogger = logger.child({ module: "elicitation" });

/**
 * Sanitize a CSV cell value to prevent formula injection in spreadsheet apps.
 * Prefixes cells starting with formula characters with a single quote.
 */
function sanitizeCsvCell(value: string): string {
  const str = String(value ?? "");
  if (/^[=+\-@\t]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Escape and optionally quote a CSV cell value per RFC 4180.
 */
function escapeCsvValue(value: string): string {
  const sanitized = sanitizeCsvCell(value);
  if (
    sanitized.includes(",") ||
    sanitized.includes('"') ||
    sanitized.includes("\n") ||
    sanitized.includes("\r")
  ) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

/**
 * Serialize a Firestore field value to a plain string for CSV output.
 * Handles Timestamps, arrays, and nested objects gracefully.
 */
function serializeFieldValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  // Firestore Timestamp: has a toDate() method
  if (
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeFieldValue(item)).join("; ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

const PARTICIPANT_EXCLUDED_FIELDS = new Set([
  "interactions",
  "name",
  "limit_reached_notified",
  "event_id",
]);

/**
 * Returns true for participant interaction objects that are user messages
 * (bot responses carry a 'response' field; user messages do not).
 */
function isUserMessage(i: unknown): i is { message: unknown } {
  return (
    typeof i === "object" && i !== null && "message" in i && !("response" in i)
  );
}

/**
 * Convert a participant Firestore document into a flat string record for CSV output.
 */
function participantDocToRow(
  data: FirebaseFirestore.DocumentData,
): Record<string, string> {
  const commentBody = (
    Array.isArray(data.interactions) ? data.interactions : []
  )
    .filter(isUserMessage)
    .map((i) => String(i.message ?? ""))
    .join(" ")
    .replace(/\[/g, "")
    .replace(/\]/g, "")
    .replace(/'/g, "");

  const dynamicFields = Object.fromEntries(
    Object.entries(data)
      .filter(
        ([key, value]) =>
          !PARTICIPANT_EXCLUDED_FIELDS.has(key) && value != null,
      )
      .map(([key, value]) => [key, serializeFieldValue(value)]),
  );

  return {
    name: serializeFieldValue(data.name ?? ""),
    "comment-body": commentBody,
    ...dynamicFields,
  };
}

/**
 * Build a CSV string from headers and rows.
 */
function buildCsvContent(headers: string[], rows: string[][]): string {
  const lines = [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => row.map(escapeCsvValue).join(",")),
  ];
  return `${lines.join("\n")}\n`;
}

/**
 * Get elicitation collection name with environment suffix
 */
function getElicitationCollectionName(env: string): string {
  const baseName = "elicitation_bot_events";
  return env === "production" ? baseName : `${baseName}_dev`;
}

/**
 * Get elicitation events owned by the authenticated user
 * Returns events with participant counts, sorted by created date (newest first)
 *
 * Requires: authMiddleware()
 * Requires: event_organizer role
 */
/**
 * Helper function to build event summary from Firestore document
 */
async function buildEventSummary(
  doc: FirebaseFirestore.DocumentSnapshot,
  userId: string,
): Promise<ElicitationEventSummary> {
  const data = doc.data();
  if (!data) {
    throw new Error("Document data is undefined");
  }

  // Count participants in the subcollection
  const participantsSnapshot = await doc.ref
    .collection("participants")
    .count()
    .get();
  const responderCount = participantsSnapshot.data().count;

  return {
    id: doc.id,
    eventName: data.event_name || "",
    description: data.description,
    ownerUserId: data.owner_user_id || userId,
    responderCount,
    createdAt: data.created_at?.toDate() || new Date(),
    startDate: data.start_date?.toDate(),
    endDate: data.end_date?.toDate(),
    status: data.status,
    mode: data.mode,
    whatsappLink: data.whatsapp_link,
    mainQuestion: data.main_question,
    questions: data.questions,
    followUpQuestions: data.follow_up_questions,
    initialMessage: data.initial_message,
    completionMessage: data.completion_message,
    reportId: data.report_id,
    reportIds: data.report_ids,
    schemaVersion: data.schema_version,
  };
}

export async function getElicitationEvents(
  req: RequestWithAuth,
  res: Response,
): Promise<void> {
  try {
    const decodedUser = req.auth;
    const userId = decodedUser.uid;

    // Check feature flag
    const featureEnabled = await isFeatureEnabled(
      FEATURE_FLAGS.ELICITATION_ENABLED,
      { userId },
    );
    if (!featureEnabled) {
      sendErrorByCode(res, ERROR_CODES.AUTH_UNAUTHORIZED, elicitationLogger);
      return;
    }

    // Get user document to check roles
    const userRef = db.collection(getCollectionName("USERS")).doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      elicitationLogger.warn({ userId }, "User document not found");
      sendErrorByCode(res, ERROR_CODES.USER_NOT_FOUND, elicitationLogger);
      return;
    }

    const userData = userDoc.data();
    const roles = userData?.roles || [];

    // Check for event_organizer role
    if (!isEventOrganizer(roles)) {
      elicitationLogger.warn(
        { userId, roles },
        "User missing event_organizer role",
      );
      sendErrorByCode(res, ERROR_CODES.AUTH_UNAUTHORIZED, elicitationLogger);
      return;
    }

    // Query elicitation events by owner_user_id
    const collectionName = getElicitationCollectionName(
      req.context.env.NODE_ENV,
    );
    const eventsSnapshot = await db
      .collection(collectionName)
      .where("owner_user_id", "==", userId)
      .get();

    // Build event summaries with participant counts
    const events: ElicitationEventSummary[] = await Promise.all(
      eventsSnapshot.docs.map((doc) => buildEventSummary(doc, userId)),
    );

    // Sort by createdAt, newest first
    events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Validate response schema
    const validatedResponse = api.elicitationEventsResponse.parse({ events });

    elicitationLogger.info(
      { userId, eventCount: events.length },
      "Elicitation events retrieved",
    );

    res.json(validatedResponse);
  } catch (error) {
    elicitationLogger.error({ error }, "Failed to get elicitation events");
    sendErrorByCode(res, ERROR_CODES.INTERNAL_ERROR, elicitationLogger);
  }
}

/**
 * Download participant response data for a single elicitation event as CSV.
 *
 * Requires: authMiddleware()
 * Requires: event_organizer role
 * Requires: User must own the event
 */
export async function downloadElicitationEventCsv(
  req: RequestWithAuth,
  res: Response,
): Promise<void> {
  try {
    const decodedUser = req.auth;
    const userId = decodedUser.uid;
    const eventId = req.params.id;

    if (!eventId) {
      elicitationLogger.warn({ userId }, "Event ID not provided");
      sendErrorByCode(res, ERROR_CODES.INVALID_REQUEST, elicitationLogger);
      return;
    }

    // Get user document to check roles
    const userRef = db.collection(getCollectionName("USERS")).doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      elicitationLogger.warn({ userId }, "User document not found");
      sendErrorByCode(res, ERROR_CODES.USER_NOT_FOUND, elicitationLogger);
      return;
    }

    const userData = userDoc.data();
    const roles = userData?.roles || [];

    if (!isEventOrganizer(roles)) {
      elicitationLogger.warn(
        { userId, roles },
        "User missing event_organizer role",
      );
      sendErrorByCode(res, ERROR_CODES.AUTH_UNAUTHORIZED, elicitationLogger);
      return;
    }

    // Get event document
    const collectionName = getElicitationCollectionName(
      req.context.env.NODE_ENV,
    );
    const eventDoc = await db.collection(collectionName).doc(eventId).get();

    if (!eventDoc.exists) {
      elicitationLogger.warn({ userId, eventId }, "Event not found");
      sendErrorByCode(res, ERROR_CODES.REPORT_NOT_FOUND, elicitationLogger);
      return;
    }

    // Verify ownership
    const eventData = eventDoc.data();
    if (eventData?.owner_user_id !== userId) {
      elicitationLogger.warn(
        { userId, eventId, ownerId: eventData?.owner_user_id },
        "User does not own this event",
      );
      sendErrorByCode(res, ERROR_CODES.AUTH_UNAUTHORIZED, elicitationLogger);
      return;
    }

    // Fetch all participant documents
    const participantsSnapshot = await eventDoc.ref
      .collection("participants")
      .get();

    const rows = participantsSnapshot.docs
      .filter((doc) => doc.id !== "info")
      .map((doc) => participantDocToRow(doc.data()));

    const dynamicColumns = [
      ...new Set(rows.flatMap((row) => Object.keys(row))),
    ].sort();
    const headers = ["comment-id", ...dynamicColumns];

    const csvRows = rows.map((row, index) => [
      String(index + 1),
      ...dynamicColumns.map((key) => row[key] ?? ""),
    ]);

    const csvContent = buildCsvContent(headers, csvRows);

    // Build a filesystem-safe filename from the event name
    const eventName = String(eventData?.event_name ?? eventId);
    const safeFilename = eventName
      .replace(/[^a-zA-Z0-9\s-_]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .substring(0, 60);

    elicitationLogger.info(
      { userId, eventId, participantCount: rows.length },
      "Elicitation event CSV downloaded",
    );

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeFilename}_responses.csv"`,
    );
    res.send(csvContent);
  } catch (error) {
    elicitationLogger.error({ error }, "Failed to download elicitation CSV");
    sendErrorByCode(res, ERROR_CODES.INTERNAL_ERROR, elicitationLogger);
  }
}

/**
 * Generate a report from participant data for an elicitation event.
 * Fetches participant responses, converts to SourceRow format, creates a report,
 * and associates the report ID with the event.
 *
 * Requires: authMiddleware()
 * Requires: event_organizer role
 * Requires: User must own the event
 */
export async function generateReportForEvent(
  req: RequestWithAuth,
  res: Response,
): Promise<void> {
  try {
    const decodedUser = req.auth;
    const userId = decodedUser.uid;
    const eventId = req.params.id;

    if (!eventId) {
      elicitationLogger.warn({ userId }, "Event ID not provided");
      sendErrorByCode(res, ERROR_CODES.INVALID_REQUEST, elicitationLogger);
      return;
    }

    // Get user document to check roles
    const userRef = db.collection(getCollectionName("USERS")).doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      elicitationLogger.warn({ userId }, "User document not found");
      sendErrorByCode(res, ERROR_CODES.USER_NOT_FOUND, elicitationLogger);
      return;
    }

    const userData = userDoc.data();
    const roles = userData?.roles || [];

    if (!isEventOrganizer(roles)) {
      elicitationLogger.warn(
        { userId, roles },
        "User missing event_organizer role",
      );
      sendErrorByCode(res, ERROR_CODES.AUTH_UNAUTHORIZED, elicitationLogger);
      return;
    }

    // Get event document
    const collectionName = getElicitationCollectionName(
      req.context.env.NODE_ENV,
    );
    const eventDoc = await db.collection(collectionName).doc(eventId).get();

    if (!eventDoc.exists) {
      elicitationLogger.warn({ userId, eventId }, "Event not found");
      sendErrorByCode(res, ERROR_CODES.REPORT_NOT_FOUND, elicitationLogger);
      return;
    }

    // Verify ownership
    const eventData = eventDoc.data();
    if (eventData?.owner_user_id !== userId) {
      elicitationLogger.warn(
        { userId, eventId, ownerId: eventData?.owner_user_id },
        "User does not own this event",
      );
      sendErrorByCode(res, ERROR_CODES.AUTH_UNAUTHORIZED, elicitationLogger);
      return;
    }

    // Fetch all participant documents
    const participantsSnapshot = await eventDoc.ref
      .collection("participants")
      .get();

    const participantRows = participantsSnapshot.docs
      .filter((doc) => doc.id !== "info")
      .map((doc) => participantDocToRow(doc.data()));

    // Convert to SourceRow format, filtering out empty comments
    const sourceRows: schema.SourceRow[] = participantRows
      .filter((row) => row["comment-body"]?.trim())
      .map((row, i) => {
        const sr: schema.SourceRow = {
          id: `cm${i}`,
          comment: row["comment-body"],
        };
        if (row["name"]) {
          sr.interview = row["name"];
        }
        return sr;
      });

    if (sourceRows.length === 0) {
      elicitationLogger.warn(
        { userId, eventId },
        "No participant responses found for report generation",
      );
      sendErrorByCode(res, ERROR_CODES.INVALID_REQUEST, elicitationLogger);
      return;
    }

    // Add anonymous names to participants without names
    const dataWithNames = addAnonymousNames({ data: sourceRows });

    // Build userConfig from event data + default prompts
    const eventName = String(eventData?.event_name || "Study Report");
    const eventDescription = String(
      eventData?.description || eventData?.event_name || "Study Report",
    );
    const userConfig: schema.LLMUserConfig = {
      title: eventName,
      description: eventDescription,
      systemInstructions: prompts.defaultSystemPrompt,
      clusteringInstructions: prompts.defaultClusteringPrompt,
      extractionInstructions: prompts.defaultExtractionPrompt,
      dedupInstructions: prompts.defaultDedupPrompt,
      summariesInstructions: prompts.defaultSummariesPrompt,
      cruxInstructions: prompts.defaultCruxPrompt,
      cruxesEnabled: false,
      bridgingEnabled: false,
      outputLanguage: "English",
      isPublic: false,
    };

    // Generate a new reportId
    const reportId = db.collection(getCollectionName("REPORT_REF")).doc().id;

    // Create storage placeholder
    const storage = createStorage(req.context.env);
    const { jsonUrl } = await createAndSaveReport(storage, reportId);

    // Create Firebase documents
    const { firebaseJobId, reportId: createdReportId } =
      await createUserDocuments(decodedUser, userConfig, jsonUrl, reportId, eventId);

    if (!firebaseJobId) throw new Error("Failed to create firebase job");
    if (!createdReportId) throw new Error("Failed to create report reference");

    // Build and enqueue the pipeline job
    const processedData: schema.SourceRow[] = dataWithNames.data.map(
      (row, i) => ({
        ...row,
        id: row.id || `cm${i}`,
      }),
    );

    const pipelineJob = buildPipelineJob(
      req.context.env,
      decodedUser,
      firebaseJobId,
      reportId,
      userConfig,
      { ...userConfig, data: processedData },
      jsonUrl,
    );

    const selectedQueue = await selectQueue(req.auth);
    await selectedQueue.enqueue(pipelineJob, {});

    // Associate the new report with the elicitation event
    await db
      .collection(collectionName)
      .doc(eventId)
      .update({
        report_ids: FieldValue.arrayUnion(reportId),
      });

    const reportUrl = new URL(
      `report/${reportId}`,
      req.context.env.CLIENT_BASE_URL,
    ).toString();

    elicitationLogger.info(
      { userId, eventId, reportId, participantCount: sourceRows.length },
      "Report generation started for elicitation event",
    );

    res.json({ reportId, reportUrl });
  } catch (error) {
    elicitationLogger.error(
      { error },
      "Failed to generate report for elicitation event",
    );
    sendErrorByCode(res, ERROR_CODES.INTERNAL_ERROR, elicitationLogger);
  }
}

/**
 * Get a single elicitation event by ID
 * Returns event details with participant count
 *
 * Requires: authMiddleware()
 * Requires: event_organizer role
 * Requires: User must own the event
 */
export async function getElicitationEvent(
  req: RequestWithAuth,
  res: Response,
): Promise<void> {
  try {
    const decodedUser = req.auth;
    const userId = decodedUser.uid;
    const eventId = req.params.id;

    // Check feature flag
    const featureEnabled = await isFeatureEnabled(
      FEATURE_FLAGS.ELICITATION_ENABLED,
      { userId },
    );
    if (!featureEnabled) {
      sendErrorByCode(res, ERROR_CODES.AUTH_UNAUTHORIZED, elicitationLogger);
      return;
    }

    if (!eventId) {
      elicitationLogger.warn({ userId }, "Event ID not provided");
      sendErrorByCode(res, ERROR_CODES.INVALID_REQUEST, elicitationLogger);
      return;
    }

    // Get user document to check roles
    const userRef = db.collection(getCollectionName("USERS")).doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      elicitationLogger.warn({ userId }, "User document not found");
      sendErrorByCode(res, ERROR_CODES.USER_NOT_FOUND, elicitationLogger);
      return;
    }

    const userData = userDoc.data();
    const roles = userData?.roles || [];

    // Check for event_organizer role
    if (!isEventOrganizer(roles)) {
      elicitationLogger.warn(
        { userId, roles },
        "User missing event_organizer role",
      );
      sendErrorByCode(res, ERROR_CODES.AUTH_UNAUTHORIZED, elicitationLogger);
      return;
    }

    // Get event document
    const collectionName = getElicitationCollectionName(
      req.context.env.NODE_ENV,
    );
    const eventDoc = await db.collection(collectionName).doc(eventId).get();

    if (!eventDoc.exists) {
      elicitationLogger.warn({ userId, eventId }, "Event not found");
      sendErrorByCode(res, ERROR_CODES.REPORT_NOT_FOUND, elicitationLogger);
      return;
    }

    // Verify ownership
    const eventData = eventDoc.data();
    if (eventData?.owner_user_id !== userId) {
      elicitationLogger.warn(
        { userId, eventId, ownerId: eventData?.owner_user_id },
        "User does not own this event",
      );
      sendErrorByCode(res, ERROR_CODES.AUTH_UNAUTHORIZED, elicitationLogger);
      return;
    }

    // Build event summary
    const event = await buildEventSummary(eventDoc, userId);

    elicitationLogger.info({ userId, eventId }, "Elicitation event retrieved");

    res.json({ event });
  } catch (error) {
    elicitationLogger.error({ error }, "Failed to get elicitation event");
    sendErrorByCode(res, ERROR_CODES.INTERNAL_ERROR, elicitationLogger);
  }
}
