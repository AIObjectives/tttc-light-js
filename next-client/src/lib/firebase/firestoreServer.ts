/**
 * Firestore Operations (Server SDK)
 *
 * Server-side database operations using the Firebase Admin SDK.
 * These operations:
 * - Run on the server with administrative privileges
 * - Can bypass Firestore security rules when needed
 * - Are used in API routes and server components
 * - Have full access to the database regardless of user permissions
 *
 * Note: The server SDK bypasses security rules, so we must implement
 * our own authorization logic in the API routes that use these functions.
 */

import { Firestore, FieldValue } from "firebase-admin/firestore";
import { FeedbackRequest } from "../types/clientRoutes";

/**
 * Add feedback using server SDK with admin privileges.
 * This bypasses Firestore security rules, so authorization
 * must be handled in the calling API route.
 */
export async function addFeedback(
  db: Firestore,
  data: FeedbackRequest,
): Promise<"success"> {
  await db.collection("FEEDBACK").add({
    ...data,
    userId: data.userId ?? "Unsigned",
    timestamp: FieldValue.serverTimestamp(),
  });
  return "success";
}
