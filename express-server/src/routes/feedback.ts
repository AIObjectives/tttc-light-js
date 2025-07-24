import { Request, Response } from "express";
import {
  verifyUser,
  ensureUserDocument,
  db,
  admin,
  getCollectionName,
} from "../Firebase";
import { DecodedIdToken } from "firebase-admin/auth";
import { sendError } from "./sendError";
import { z } from "zod";
import { logger } from "tttc-common/logger";

const feedbackRequest = z.object({
  text: z.string(),
  firebaseAuthToken: z.string(),
});

export default async function feedback(req: Request, res: Response) {
  console.log("[UserAccount] EXPRESS FEEDBACK: Feedback endpoint called");
  try {
    const parsed = feedbackRequest.safeParse(req.body);

    if (!parsed.success) {
      console.log("[UserAccount] EXPRESS FEEDBACK: Invalid request format");
      return sendError(res, 400, "Invalid request format", "ValidationError");
    }

    const { text, firebaseAuthToken } = parsed.data;

    const decodedUser: DecodedIdToken = await verifyUser(firebaseAuthToken);
    console.log(
      `[UserAccount] EXPRESS FEEDBACK: Token verified for UID: ${decodedUser.uid}`,
    );

    // Ensure user document exists (in case feedback is submitted before other operations)
    const userDocRef = db
      .collection(getCollectionName("USERS"))
      .doc(decodedUser.uid);
    const userDocSnap = await userDocRef.get();
    if (!userDocSnap.exists) {
      await ensureUserDocument(
        decodedUser.uid,
        decodedUser.email || null,
        decodedUser.name || null,
      );
    }

    // Add feedback to Firestore
    const { env } = req.context;
    const collectionName = getCollectionName("FEEDBACK");
    const feedbackCollection = db.collection(collectionName);

    await feedbackCollection.add({
      userId: decodedUser.uid,
      text,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(
      `[UserAccount] EXPRESS FEEDBACK: Feedback submitted successfully for UID: ${decodedUser.uid}`,
    );
    res.json({
      success: true,
      message: "Feedback submitted successfully",
    });
  } catch (error) {
    console.error(
      "[UserAccount] EXPRESS FEEDBACK: Error submitting feedback:",
      error,
    );
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    sendError(res, 500, message, "FeedbackError");
  }
}
