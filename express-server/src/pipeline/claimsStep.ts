import * as apiPyserver from "tttc-common/apiPyserver";
import { ClaimsStep } from "./types";
import { Env } from "../types/context";
import { z } from "zod";

const typedFetch =
  <T extends z.ZodTypeAny>(bodySchema: T) =>
  async (url: string, body: z.infer<T>) =>
    await fetch(url, {
      method: "post",
      body: JSON.stringify(bodySchema.parse(body) as z.infer<T>),
      headers: {
        "Content-Type": "application/json",
      },
    });

const batch_size = 2;

const chunkArray = <T>(arg: T[], chunk_size: number, result: T[][] = []) => {
  if (!arg.length) return result;
  const chunk = arg.slice(0, chunk_size);
  const newArg = arg.slice(chunk_size);
  return chunkArray(newArg, chunk_size, [...result, chunk]);
};

const batchComments = (
  largeRequest: ClaimsStep["data"],
): ClaimsStep["data"][] => {
  const commentChunks = chunkArray(largeRequest.comments, batch_size);
  return commentChunks.map((chunk) => ({
    ...largeRequest,
    comments: chunk,
  }));
};

const pyserverFetchClaims = typedFetch(apiPyserver.claimsRequest);

const pyserverMergeClaims = typedFetch(apiPyserver.mergeClaimsBatchesRequest);

/**
 * Fault tolerant version of fetchBatchClaims
 * Not tested
 */
// const fetchBatchClaims = async(env:Env, requests:ClaimsStep['data'][]):Promise<apiPyserver.ClaimsReply[]> => {
//   const promises = requests.map((req) => pyserverFetchClaims(`${env.PYSERVER_URL}/batch_N_claims`, req))

//   const resolved = await Promise.allSettled(promises)

//   const results = resolved.reduce((accum, curr) => {
//     if (curr.status === 'fulfilled') {
//       return {...accum, succeeded: [...accum.succeeded, curr.value]}
//     } else {
//       return {...accum, failed: [...accum.failed, curr.reason]}
//     }
//   },{succeeded: [], failed: []})

//   const failed = {count: results.failed.length, reasons: Array.from(new Set(results.failed))}

//   console.error(
//     `
//     BATCH REQUEST FAILURES:
//     Count: ${failed.count}
//     Reasons: ${JSON.stringify(failed.reasons)}
//     `
//   )
//   const parsePromises = results.succeeded.map((res) => res.json())
//   const parsedJson = await Promise.all(parsePromises)
//   const parsed = parsedJson
//     .map((val) => apiPyserver.claimsReply.safeParse(val))

//   const parseSuccess:apiPyserver.ClaimsReply[] = parsed
//     .map((res) => res.success ? res.data : null)
//     .filter((res) => res !== null)

//   const parseFails = parsed
//     .filter((res) => !res.success)

//   console.error(
//     `
//     PARSE FAILURES:
//     Count: ${parseFails.length}
//     `
//   )

//   return parseSuccess

// }

const fetchBatchClaims = async (env: Env, requests: ClaimsStep["data"][]) => {
  try {
    const promises = requests.map((req) =>
      pyserverFetchClaims(`${env.PYSERVER_URL}/batch_N_claims`, req),
    );
    const resolved = await Promise.all(promises)
      .then((prom) => prom.map(async (res) => await res.json()))
      .then(apiPyserver.claimsReply.array().parse);
    return resolved;
  } catch (e) {
    if (e instanceof Error) {
      throw new Error(`Could not resolve requests in step two: ${e.message}`);
    } else {
      throw new Error("Could not resolve requests in step two");
    }
  }
};

const logger =
  (prependMessage: string) =>
  <T>(arg: T): T => {
    console.log(prependMessage, arg);
    return arg;
  };

export async function claimsPipelineStep(env: Env, input: ClaimsStep["data"]) {
  const nestedClaims = await fetchBatchClaims(env, batchComments(input));

  const claims = nestedClaims.flat();

  const merged = await pyserverMergeClaims(
    `${env.PYSERVER_URL}/merge_claims_batches`,
    {
      data: {
        claims: claims.flatMap((claim) => {
          return claim.data.flat();
        }),
        tree: input.tree,
      },
    },
  ).then(apiPyserver.mergeClaimsBatchesReply.parse);

  return { claims_tree: merged };
}
