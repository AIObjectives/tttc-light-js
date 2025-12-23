import type { Response } from "express";
import { ERROR_CODES } from "tttc-common/errors";
import { z } from "zod";
import { admin, db, ensureUserDocument, getCollectionName } from "../Firebase";
import type { RequestWithAuth } from "../types/request";
import { sendErrorByCode } from "./sendError";

const feedbackRequest = z.object({
  text: z.string(),
});

/**
 * Submit user feedback
 *
 * Requires: authMiddleware({ tokenLocation: "body" })
 */
export default async function feedback(req: RequestWithAuth, res: Response) {
  req.log.info("Feedback endpoint called");
  try {
    const parsed = feedbackRequest.safeParse(req.body);

    if (!parsed.success) {
      req.log.warn("Invalid request format");
      return sendErrorByCode(res, ERROR_CODES.VALIDATION_ERROR, req.log);
    }

    const { text } = parsed.data;

    const decodedUser = req.auth;
    req.log.info({ uid: decodedUser.uid }, "Token verified");

    // Require email verification for email/password users
    const isEmailPasswordUser =
      decodedUser.firebase?.sign_in_provider === "password";
    if (isEmailPasswordUser && !decodedUser.email_verified) {
      req.log.warn({ uid: decodedUser.uid }, "Email not verified");
      return sendErrorByCode(res, ERROR_CODES.AUTH_EMAIL_NOT_VERIFIED, req.log);
    }

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
    const collectionName = getCollectionName("FEEDBACK");
    const feedbackCollection = db.collection(collectionName);

    await feedbackCollection.add({
      userId: decodedUser.uid,
      text,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    req.log.info({ uid: decodedUser.uid }, "Feedback submitted successfully");
    res.json({
      success: true,
      message: "Feedback submitted successfully",
    });
  } catch (error) {
    req.log.error({ error }, "Error submitting feedback");
    sendErrorByCode(res, ERROR_CODES.INTERNAL_ERROR, req.log);
  }
}
