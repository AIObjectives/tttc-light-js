import type { Response } from "express";
import * as api from "tttc-common/api";
import { ERROR_CODES } from "tttc-common/errors";
import type { ElicitationEventSummary } from "tttc-common/firebase";
import { logger } from "tttc-common/logger";
import { isEventOrganizer } from "tttc-common/permissions";
import { db, getCollectionName } from "../Firebase";
import type { RequestWithAuth } from "../types/request";
import { sendErrorByCode } from "./sendError";

const elicitationLogger = logger.child({ module: "elicitation" });

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
export async function getElicitationEvents(
  req: RequestWithAuth,
  res: Response,
): Promise<void> {
  try {
    const decodedUser = req.auth;
    const userId = decodedUser.uid;

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
      eventsSnapshot.docs.map(async (doc) => {
        const data = doc.data();

        // Count participants in the subcollection
        const participantsSnapshot = await doc.ref
          .collection("participants")
          .count()
          .get();
        const responderCount = participantsSnapshot.data().count;

        return {
          id: doc.id,
          eventName: data.event_name || "",
          ownerUserId: data.owner_user_id || userId,
          responderCount,
          createdAt: data.created_at?.toDate() || new Date(),
          mainQuestion: data.main_question,
          initialMessage: data.initial_message,
          completionMessage: data.completion_message,
        };
      }),
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
