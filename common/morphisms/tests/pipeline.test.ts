import { assert, beforeAll, expect, test } from "vitest";
import * as schema from "../../schema";
import { z } from "zod";
import { llmPipelineToSchema, _internal } from "../pipeline";
const {
  getTopicsFromTaxonomy,
  getReferenceEndIndex,
  getReferenceStartIndex,
  getReportDataObj,
  getReportMetaData,
  buildSourceMap,
  buildClaimsMap,
  getQuote,
  numberClaims,
} = _internal;
const getPipelineData = async () => {
  const res = await fetch(
    "https://storage.googleapis.com/tttc-light-dev/test-1718663339961",
  );
  return await res.json().then(schema.llmPipelineOutput.parse);
};

let pipelineData: schema.LLMPipelineOutput | undefined;

beforeAll(async () => {
  pipelineData = await getPipelineData();
});

test("Can build map of sources with sourceRow id as key", () => {
  const sourceMap = buildSourceMap(pipelineData.data);

  expect(
    pipelineData.data.every(
      (row) => schema.source.safeParse(sourceMap[row.id]).success,
    ),
  ).true;
  expect(Object.entries(sourceMap).length === pipelineData.data.length).true;
});

test("Can create quotes", () => {
  const sourceMap = buildSourceMap(pipelineData.data);
  const allClaims = pipelineData.tree.flatMap((topic) =>
    topic.subtopics.flatMap((subtopic) =>
      subtopic.claims.concat(subtopic.claims.flatMap((clm) => clm.duplicates)),
    ),
  );
  const quotes = allClaims.map((clm) => getQuote(clm, sourceMap));

  expect(schema.quote.array().safeParse(quotes).success).true;
});

test("Can properly number claims", () => {
  const createClaim = numberClaims();
  const claim1: schema.LLMClaim = {
    claim: "test1",
    claimId: "1",
    quote: "",
    topicName: "",
    commentId: "1",
  };
  const claim2: schema.LLMClaim = {
    claim: "test2",
    claimId: "2",
    quote: "",
    topicName: "",
    commentId: "2",
  };
  const claim3: schema.LLMClaim = {
    claim: "test3",
    claimId: "3",
    quote: "",
    topicName: "",
    duplicates: [claim1],
    commentId: "3",
  };

  const sources: Record<string, schema.Source> = {
    "1": { id: "1", data: ["text", { text: "" }] },
    "2": { id: "2", data: ["text", { text: "" }] },
    "3": { id: "3", data: ["text", { text: "" }] },
  };

  const claimMap: Record<string, schema.Claim> = {};

  const newClaim1 = createClaim(claim1, sources, claimMap);
  expect(schema.claim.safeParse(newClaim1).success).true;
  claimMap[claim1.claimId] = newClaim1;
  const repeatedClaim1 = createClaim(claim1, sources, claimMap);
  expect(repeatedClaim1).toEqual(newClaim1);
  expect(newClaim1.number).toBe(1);

  // test adding a new claim increases number
  const newClaim2 = createClaim(claim2, sources, claimMap);
  expect(newClaim2.number).toBe(2);
  claimMap[claim2.claimId] = newClaim2;

  // test that nested claims aren't recounted
  const newClaim3 = createClaim(claim3, sources, claimMap);
  expect(newClaim3.similarClaims[0]).toEqual(newClaim1);

  const resetCreateClaim = numberClaims();
  const resetClaimMap: Record<string, schema.Claim> = {};

  const resetClaim3 = resetCreateClaim(claim3, sources, resetClaimMap);
  expect(resetClaim3.similarClaims[0].number).toBe(2);
  resetClaimMap[claim3.claimId] = resetClaim3;
  resetClaimMap[claim1.claimId] = resetClaim3.similarClaims[0];

  const resetClaim1 = resetCreateClaim(claim1, sources, resetClaimMap);
  expect(resetClaim3.similarClaims[0]).toEqual(resetClaim1);
});

test("Can build map of claims", () => {
  const sourceMap = buildSourceMap(pipelineData.data);

  const claimMap = buildClaimsMap(pipelineData, sourceMap);
  const entries = Object.values(claimMap);

  expect(schema.claim.array().safeParse(entries).success).true;

  const allClaims = pipelineData.tree.flatMap((topic) =>
    topic.subtopics.flatMap((subtopic) =>
      subtopic.claims.concat(subtopic.claims.flatMap((clm) => clm.duplicates)),
    ),
  );
  expect(Object.entries(claimMap).length === allClaims.length).true;
});

test("Claims all have a unique number, 1 to n", () => {
  const numSet = new Set<number>();
  const sourceMap = buildSourceMap(pipelineData.data);

  const claimMap = buildClaimsMap(pipelineData, sourceMap);
  const entries = Object.values(claimMap);

  expect(
    entries.every((claim) => {
      if (numSet.has(claim.number)) return false;
      numSet.add(claim.number);
      return true;
    }),
  ).true;
  const numbers = entries.map((claim) => claim.number);
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);

  // If every number is unique, then 1..n where n is the length should exist. Can test by seeing if higher or lower number
  expect(min).toBe(1);
  expect(max).toBe(numbers.length);
});

test("Get correct referenceIndices", () => {
  const clm: schema.LLMClaim = {
    claim: "",
    quote: "quick",
    topicName: "",
  };

  const srcRow: schema.SourceRow = {
    id: "",
    comment: "The quick brown fox jumps over the lazy dog",
  };

  const startIdx = getReferenceStartIndex(clm, srcRow.comment);
  expect(startIdx).toBe(4);

  const endIdx = getReferenceEndIndex(clm, srcRow.comment);
  expect(endIdx).toBe(9);

  expect(srcRow.comment.slice(startIdx, endIdx)).toBe("quick");
});

test("Get themes from taxonomy", () => {
  const sourceMap = buildSourceMap(pipelineData.data);

  const claimMap = buildClaimsMap(pipelineData, sourceMap);
  const themes = getTopicsFromTaxonomy(claimMap)(pipelineData.tree);
  expect(schema.topic.array().safeParse(themes).success).true;
});

test("Can get reportDataObj from pipeline", () => {
  const report = getReportDataObj(pipelineData!);

  expect(schema.reportDataObj.safeParse(report).success).true;

  // check for incorrect src ids
  expect(
    report.topics
      .flatMap((topic) =>
        topic.subtopics.flatMap((topic) =>
          topic.claims.flatMap((claim) =>
            claim.quotes.map((quote) => quote.reference.sourceId),
          ),
        ),
      )
      .every((id) => id !== ""),
  ).true;
});

test("Can get report metadata", () => {
  const metadata = getReportMetaData(pipelineData!);
  expect(schema.reportMetadataObj.safeParse(metadata).success).true;
});

test("LLM pipeline to new schema", () => {
  const data = llmPipelineToSchema(pipelineData!);

  expect(schema.pipelineOutput.safeParse(data).success).true;
});
