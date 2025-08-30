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

    // Parse reports and handle validation issues gracefully
    type MalformedReport = Partial<{
      id: string;
      userId: string;
      reportDataUri: string;
      title: string;
      description: string;
      numTopics: number;
      numSubtopics: number;
      numClaims: number;
      numPeople: number;
      createdDate: Date;
      jobId: string;
    }>;

    const reportRefs = reportsWithIds.map((report) => {
      try {
        return reportRef.parse(report);
      } catch (e) {
        console.warn("Report validation issues:", report.id, e);
        const originalReport: MalformedReport = report;
        return {
          id: originalReport?.id ?? "",
          userId: originalReport?.userId ?? "",
          reportDataUri: originalReport?.reportDataUri ?? "about:blank",
          title: originalReport?.title ?? "Untitled Report",
          description:
            originalReport?.description ?? "Report processing failed",
          numTopics: originalReport?.numTopics ?? 0,
          numSubtopics: originalReport?.numSubtopics ?? 0,
          numClaims: originalReport?.numClaims ?? 0,
          numPeople: originalReport?.numPeople ?? 0,
          createdDate: originalReport?.createdDate ?? new Date(),
          jobId: originalReport?.jobId,
        };
      }
    });
    return success(reportRefs);
  } catch (e) {
    console.error("Error in getUsersReports:", e);
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
