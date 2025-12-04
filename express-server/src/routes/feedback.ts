import { Response } from "express";
import { RequestWithLogger } from "../types/request";
import {
  verifyUser,
  ensureUserDocument,
  db,
  admin,
  getCollectionName,
} from "../Firebase";
import { DecodedIdToken } from "firebase-admin/auth";
import { sendErrorByCode } from "./sendError";
import { ERROR_CODES } from "tttc-common/errors";
import { z } from "zod";

const feedbackRequest = z.object({
  text: z.string(),
  firebaseAuthToken: z.string(),
});

export default async function feedback(req: RequestWithLogger, res: Response) {
  req.log.info("Feedback endpoint called");
  try {
    const parsed = feedbackRequest.safeParse(req.body);

    if (!parsed.success) {
      req.log.warn("Invalid request format");
      return sendErrorByCode(res, ERROR_CODES.VALIDATION_ERROR, req.log);
    }

    const { text, firebaseAuthToken } = parsed.data;

    const decodedUser: DecodedIdToken = await verifyUser(firebaseAuthToken);
    req.log.info({ uid: decodedUser.uid }, "Token verified");

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
