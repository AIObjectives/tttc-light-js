/**
 * Firestore Operations (Client SDK)
 */

import {
  addDoc,
  collection,
  type Firestore,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import {
  type ReportRef,
  reportRef,
  reportRefWithDefaults,
  useGetCollectionName,
} from "tttc-common/firebase";
import { failure, type Result, success } from "tttc-common/functional-utils";
import { z } from "zod";
import type { FeedbackRequest } from "../types/clientRoutes";

const NODE_ENV = z
  .union([z.literal("development"), z.literal("production")])
  .parse(process.env.NODE_ENV);
// biome-ignore lint/correctness/useHookAtTopLevel: useGetCollectionName is a factory function, not a React hook despite its name
const getCollectionName = useGetCollectionName(NODE_ENV);

/**
 * Get reports for a specific user using client SDK.
 * Updated to return the correct type for useAsyncState.
 */
export async function getUsersReports(
  db: Firestore,
  userId: string,
): Promise<Result<ReportRef[], Error>> {
  try {
    const collectionRef = collection(db, getCollectionName("REPORT_REF"));
    const userQuery = query(collectionRef, where("userId", "==", userId));
    const snapshot = await getDocs(userQuery);

    const reportsWithIds = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Convert Firestore Timestamps to Date objects for client-side
        createdDate: data.createdDate?.toDate
          ? data.createdDate.toDate()
          : data.createdDate,
        // Handle empty reportDataUri (reports that haven't been processed yet)
        // Use a safe placeholder that doesn't expose internal structure
        reportDataUri: data.reportDataUri || "about:blank", // Safe placeholder that won't be confused with real URLs
      };
    });

    // Parse reports with Zod defaults for missing fields
    const reportRefs = reportsWithIds.map((report) => {
      const result = reportRef.safeParse(report);
      if (result.success) {
        return result.data;
      }

      // Apply defaults for malformed documents and log the issue
      console.warn("Report parsing failed for", report.id, "applying defaults");
      return reportRefWithDefaults.parse(report);
    });
    return success(reportRefs);
  } catch (e) {
    console.error("Error in getUsersReports:", e);
    const error =
      e instanceof Error ? e : new Error(`Could not get your reports: ${e}`);
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
  const _docRef = await addDoc(collection(db, getCollectionName("FEEDBACK")), {
    ...data,
    userId: data.userId ?? "Unsigned",
    timestamp: serverTimestamp(),
  });

  return "success";
}
