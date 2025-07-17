/**
 * Firestore Operations (Client SDK)
 */

import { z } from "zod";
import {
  collection,
  query,
  getDocs,
  where,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { Firestore } from "firebase/firestore";

import {
  useGetCollectionName,
  reportRef,
  ReportRef,
} from "tttc-common/firebase";
import { FeedbackRequest } from "../types/clientRoutes";
import { failure, Result, success } from "tttc-common/functional-utils";

const NODE_ENV = z
  .union([z.literal("development"), z.literal("production")])
  .parse(process.env.NODE_ENV);
const getCollectionName = useGetCollectionName(NODE_ENV);

/**
 * Get reports for a specific user using client SDK.
 * Updated to return the correct type for useAsyncState.
 */
export async function getUsersReports(
  db: Firestore,
  userId: string,
  // ): Promise<AsyncData<ReportRef[]> | AsyncError<Error>> {
): Promise<Result<ReportRef[], Error>> {
  try {
    const collectionRef = collection(db, getCollectionName("REPORT_REF"));
    const userQuery = query(collectionRef, where("userId", "==", userId));
    const snapshot = await getDocs(userQuery);

    const unparsedData = await Promise.all(
      snapshot.docs.map((doc) => doc.data()),
    );

    const reportRefs = reportRef.array().parse(unparsedData);

    return success(reportRefs);
  } catch (e) {
    const error =
      e instanceof Error ? e : new Error("Could not get your reports: " + e);
    return failure(error);
  }
}

/**
 * Add feedback using client SDK.
 */
export async function addFeedback(
  db: Firestore,
  data: FeedbackRequest,
): Promise<"success"> {
  const docRef = await addDoc(collection(db, getCollectionName("FEEDBACK")), {
    ...data,
    userId: data.userId ?? "Unsigned",
    timestamp: serverTimestamp(),
  });

  return "success";
}
