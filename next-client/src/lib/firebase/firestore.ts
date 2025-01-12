import { db } from "./clientApp";
import { z } from "zod";
import { collection, query, getDocs, where } from "firebase/firestore";

import {
  useGetCollectionName,
  reportRef,
  ReportRef,
} from "tttc-common/firebase";
import { AsyncData, AsyncError } from "../hooks/useAsyncState";

const NODE_ENV = z
  .union([z.literal("development"), z.literal("production")])
  .parse(process.env.NODE_ENV);
const getCollectionName = useGetCollectionName(
  NODE_ENV === "development" ? "dev" : "prod",
);

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
