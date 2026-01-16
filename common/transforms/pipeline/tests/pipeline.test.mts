import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import * as schema from "../../../schema";
import { _internal, llmPipelineToSchema } from "../../pipeline";

const {
  buildTopics,
  getReferenceEndIndex,
  getReferenceStartIndex,
  getReportDataObj,
  getReportMetaData,
  buildSourceMap,
  buildClaimsMap,
  getQuote,
  numberClaims,
} = _internal;
const getPipelineData = () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const testDataPath = join(__dirname, "fixtures", "testPipelineData.json");
  const rawData = readFileSync(testDataPath, "utf8");
  return schema.llmPipelineOutput.parse(JSON.parse(rawData));
};

let pipelineData: schema.LLMPipelineOutput;

beforeAll(() => {
  pipelineData = getPipelineData();
});

describe("Pipeline tests", () => {
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
      topic.subtopics.flatMap(
        (subtopic) =>
          // subtopic.claims.concat(subtopic.claims.flatMap((clm) => clm.duplicates)),
          subtopic.claims,
      ),
    );
    const quotes = allClaims.map((clm) => getQuote(clm, sourceMap));
    expect(true).true;
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
      topic.subtopics.flatMap(
        (subtopic) =>
          // subtopic.claims.concat(subtopic.claims.flatMap((clm) => clm.duplicates)),
          subtopic.claims,
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
    const themes = buildTopics(pipelineData.tree, claimMap);
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

  test("Subtopics with zero claims are filtered out", () => {
    const mockPipelineData: schema.LLMPipelineOutput = {
      ...pipelineData,
      tree: [
        {
          topicName: "Test Topic",
          topicShortDescription: "Test description",
          subtopics: [
            {
              subtopicName: "Subtopic with claims",
              subtopicShortDescription: "Has claims",
              claims: [
                {
                  claim: "Test claim",
                  claimId: "claim-1",
                  quote: "Test quote",
                  commentId: pipelineData.data[0].id,
                  topicName: "Test Topic",
                },
              ],
            },
            {
              subtopicName: "Empty subtopic",
              subtopicShortDescription: "No claims",
              claims: [],
            },
            {
              subtopicName: "Undefined subtopic",
              subtopicShortDescription: "Undefined claims",
            },
          ],
        },
      ],
    };

    const reportData = getReportDataObj(mockPipelineData);

    // Should only have the subtopic with claims
    expect(reportData.topics[0].subtopics.length).toBe(1);
    expect(reportData.topics[0].subtopics[0].title).toBe(
      "Subtopic with claims",
    );
    expect(reportData.topics[0].subtopics[0].claims.length).toBe(1);

    // Explicitly assert that subtopics with undefined claims are filtered out
    const subtopicTitles = reportData.topics[0].subtopics.map(
      (subtopic) => subtopic.title,
    );
    expect(subtopicTitles).not.toContain("Undefined subtopic");
    expect(subtopicTitles).not.toContain("Empty subtopic");
  });

  test("Topics with zero subtopics are filtered out", () => {
    const mockPipelineData: schema.LLMPipelineOutput = {
      ...pipelineData,
      tree: [
        {
          topicName: "Topic with subtopics",
          topicShortDescription: "Has subtopics with claims",
          subtopics: [
            {
              subtopicName: "Valid subtopic",
              subtopicShortDescription: "Has claims",
              claims: [
                {
                  claim: "Test claim",
                  claimId: "claim-1",
                  quote: "Test quote",
                  commentId: pipelineData.data[0].id,
                  topicName: "Topic with subtopics",
                },
              ],
            },
          ],
        },
        {
          topicName: "Topic with only empty subtopics",
          topicShortDescription: "All subtopics have no claims",
          subtopics: [
            {
              subtopicName: "Empty subtopic 1",
              subtopicShortDescription: "No claims",
              claims: [],
            },
            {
              subtopicName: "Empty subtopic 2",
              subtopicShortDescription: "No claims",
            },
          ],
        },
        {
          topicName: "Topic with no subtopics at all",
          topicShortDescription: "Empty subtopics array",
          subtopics: [],
        },
      ],
    };

    const reportData = getReportDataObj(mockPipelineData);

    // Should only have the topic with valid subtopics
    expect(reportData.topics.length).toBe(1);
    expect(reportData.topics[0].title).toBe("Topic with subtopics");
    expect(reportData.topics[0].subtopics.length).toBe(1);
    expect(reportData.topics[0].subtopics[0].title).toBe("Valid subtopic");

    // Explicitly assert that topics with no subtopics are filtered out
    const topicTitles = reportData.topics.map((topic) => topic.title);
    expect(topicTitles).not.toContain("Topic with only empty subtopics");
    expect(topicTitles).not.toContain("Topic with no subtopics at all");
  });

  test("Topics and subtopics with empty titles are filtered out", () => {
    const mockPipelineData: schema.LLMPipelineOutput = {
      ...pipelineData,
      tree: [
        {
          topicName: "", // Empty topic title
          topicShortDescription: "Topic with empty title",
          subtopics: [
            {
              subtopicName: "Valid subtopic under empty topic",
              subtopicShortDescription: "Has claims",
              claims: [
                {
                  claim: "Test claim",
                  claimId: "claim-1",
                  quote: "Test quote",
                  commentId: pipelineData.data[0].id,
                  topicName: "",
                },
              ],
            },
          ],
        },
        {
          topicName: "Valid Topic",
          topicShortDescription: "Has valid subtopics",
          subtopics: [
            {
              subtopicName: "", // Empty subtopic title
              subtopicShortDescription: "Subtopic with empty title",
              claims: [
                {
                  claim: "Test claim 2",
                  claimId: "claim-2",
                  quote: "Test quote 2",
                  commentId: pipelineData.data[0].id,
                  topicName: "Valid Topic",
                },
              ],
            },
            {
              subtopicName: "Valid Subtopic",
              subtopicShortDescription: "Has claims",
              claims: [
                {
                  claim: "Test claim 3",
                  claimId: "claim-3",
                  quote: "Test quote 3",
                  commentId: pipelineData.data[0].id,
                  topicName: "Valid Topic",
                },
              ],
            },
          ],
        },
      ],
    };

    const reportData = getReportDataObj(mockPipelineData);

    // Should only have the topic with valid title
    expect(reportData.topics.length).toBe(1);
    expect(reportData.topics[0].title).toBe("Valid Topic");

    // Should only have the subtopic with valid title
    expect(reportData.topics[0].subtopics.length).toBe(1);
    expect(reportData.topics[0].subtopics[0].title).toBe("Valid Subtopic");

    // Explicitly assert empty-titled items are filtered
    const topicTitles = reportData.topics.map((topic) => topic.title);
    expect(topicTitles).not.toContain("");

    const subtopicTitles = reportData.topics[0].subtopics.map(
      (subtopic) => subtopic.title,
    );
    expect(subtopicTitles).not.toContain("");
  });
}); // Close describe block
