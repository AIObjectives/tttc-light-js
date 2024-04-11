import testData from "tttc-common/fixtures/report.json";
import { getUrl, storeFile } from "../../../express-pipeline/src/storage";
import { z } from "zod";

const testJSONFileName = "testing/example";

/**
 * Returns boolean based on if the test json file is already in the GCloud bucket
 */
const checkExistingJson = async () =>
  (await fetch(getUrl(testJSONFileName + ".json"))).ok;

/**
 * Adds testJson file to bucket
 */
const setTestJson = async () =>
  await storeFile(
    testJSONFileName,
    JSON.stringify(testData),
    "application/json",
  );

/**
 * Check if Next is running
 * Returns nothing if running, error text if not.
 */
const checkNextIsRunning = async (): Promise<string[]> => {
  const nextError = "Next client test failed: ";
  try {
    const res = await (await fetch("http://localhost:3000/api/")).json();
    if (!z.object({ success: z.boolean() }).parse(res).success) {
      return [nextError + "Invalid response"];
    }
    return [];
  } catch (e) {
    return [nextError + e];
  }
};

/**
 * Returns string[] of missing env variables needed for this test
 */
const checkEnv = (): string[] =>
  ["GOOGLE_CREDENTIALS_ENCODED", "GCLOUD_STORAGE_BUCKET"].reduce(
    (accum, curr) =>
      !process.env[curr] ? [...accum, `Missing Env: ${curr}`] : accum,
    [] as string[],
  );

/**
 * Setup everything prior to test
 */
export default async function setupTest() {
  // Pre Tests
  const errorText = [...checkEnv(), ...(await checkNextIsRunning())];
  if (errorText.length > 0)
    throw new Error(
      `PreTests failed: \n\n ${errorText.map((err) => err + "\n\n")}`,
    );
  const isJsonAlreadyThere = await checkExistingJson();
  if (!isJsonAlreadyThere) {
    console.warn(
      "JSON was missing from bucket. Adding test json file to bucket now.",
    );
    await setTestJson();
  }
  return testJSONFileName + ".json";
}
