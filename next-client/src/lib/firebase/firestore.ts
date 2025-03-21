import { db } from "./clientApp";
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
import { Environment } from "tttc-common/environmentValidation";
import { AsyncData, AsyncError } from "../hooks/useAsyncState";
import { FeedbackRequest } from "../types/clientRoutes";

// Map NextJS environment values to T3C Environment type
const mapNextEnvToT3CEnv = (nextEnv: string | undefined): Environment => {
  if (!nextEnv) return "dev";
  switch (nextEnv.toLowerCase()) {
    case "development": return "dev";
    case "production": return "prod";
    case "test": return "dev";
    default: return "dev";
  }
};

const environment = mapNextEnvToT3CEnv(process.env.NODE_ENV);
const getCollectionName = useGetCollectionName(environment);

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
