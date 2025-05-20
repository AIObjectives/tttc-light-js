/**
 * Firestore Operations (Client SDK)
 *
 * Client-side database operations using the Firebase Client SDK.
 * These operations:
 * - Run in the browser with user's authentication
 * - Are subject to Firestore security rules
 * - Can work offline and sync when reconnected
 * - Use the user's permissions and auth state
 */

import { getFirebaseDb } from "./clientApp";
import { z } from "zod";
import {
  collection,
  query,
  getDocs,
  where,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

import {
  useGetCollectionName,
  reportRef,
  ReportRef,
} from "tttc-common/firebase";
import { AsyncData, AsyncError } from "../hooks/useAsyncState";
import { FeedbackRequest } from "../types/clientRoutes";

const db = getFirebaseDb();

const NODE_ENV = z
  .union([z.literal("development"), z.literal("production")])
  .parse(process.env.NODE_ENV);
const getCollectionName = useGetCollectionName(NODE_ENV);

/**
 * Get reports for a specific user using client SDK.
 * This operation goes through Firestore security rules and
 * uses the client's authentication context.
 */
export async function getUsersReports(
  store: typeof db = db,
  userId: string,
): Promise<AsyncData<ReportRef[]> | AsyncError<string>> {
  try {
    const collectionRef = collection(store, getCollectionName("REPORT_REF"));
    const userQuery = query(collectionRef, where("userId", "==", userId));
    // Log each raw document
    const snapshot = await getDocs(userQuery);

    const unparsedData = await Promise.all(
      snapshot.docs.map((doc) => doc.data()),
    );

    const reportRefs = reportRef.array().parse(unparsedData);

    return ["data", reportRefs];
  } catch (e) {
    return [
      "error",
      "Could not get your reports: " + (e instanceof Error ? e.message : e),
    ];
  }
}

/**
 * Add feedback using client SDK.
 * This operation is subject to Firestore security rules
 * and uses the current user's authentication.
 */
export async function addFeedback(
  store: typeof db = db,
  data: FeedbackRequest,
): Promise<"success"> {
  const docRef = await addDoc(
    collection(store, getCollectionName("FEEDBACK")),
    {
      ...data,
      userId: data.userId ?? "Unsigned",
      timestamp: serverTimestamp(),
    },
  );

  return "success";
}
