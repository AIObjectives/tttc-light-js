import { describe, expect, test } from "vitest";
import type * as schema from "../../schema";
import {
  getNClaims,
  getNPeopleFromClaims,
  getNPeopleFromReport,
  getNPeopleFromSubtopics,
  getNPeopleFromTopics,
  getQuotes,
} from "../tree-metrics.js";

const data = require("./data/getNPeople.json");

describe("getNPeopleFromReport", () => {
  const pipelineOutput = data as { data: [unknown, schema.ReportDataObj] };
  const report = pipelineOutput.data[1];

  test("gets correct count from report", () => {
    expect(getNPeopleFromReport(report)).toBe(8);
  });
});

describe("getNPeopleFromTopics", () => {
  const pipelineOutput = data as { data: [unknown, schema.ReportDataObj] };
  const report = pipelineOutput.data[1];
  const topics = report.topics;

  test("gets correct count from all topics", () => {
    expect(getNPeopleFromTopics(topics)).toBe(8);
  });

  test("gets correct count from individual topics", () => {
    expect(getNPeopleFromTopics([topics[0]])).toBe(5);
    expect(getNPeopleFromTopics([topics[1]])).toBe(3);
  });

  test("returns 0 for empty array", () => {
    expect(getNPeopleFromTopics([])).toBe(0);
  });
});

describe("getNPeopleFromSubtopics", () => {
  const pipelineOutput = data as { data: [unknown, schema.ReportDataObj] };
  const report = pipelineOutput.data[1];
  const subtopics = report.topics.flatMap((t) => t.subtopics);

  test("gets correct count from individual subtopics", () => {
    expect(getNPeopleFromSubtopics([subtopics[0]])).toBe(3);
    expect(getNPeopleFromSubtopics([subtopics[1]])).toBe(2);
    expect(getNPeopleFromSubtopics([subtopics[2]])).toBe(3);
    expect(getNPeopleFromSubtopics([subtopics[3]])).toBe(0);
  });

  test("returns 0 for empty array", () => {
    expect(getNPeopleFromSubtopics([])).toBe(0);
  });
});

describe("getNPeopleFromClaims", () => {
  const pipelineOutput = data as { data: [unknown, schema.ReportDataObj] };
  const report = pipelineOutput.data[1];
  const subtopics = report.topics.flatMap((t) => t.subtopics);

  test("gets correct count from claims", () => {
    const firstSubtopicClaims = subtopics[0].claims;
    expect(getNPeopleFromClaims(firstSubtopicClaims)).toBe(3);
  });

  test("handles claims with similarClaims", () => {
    const allClaims = subtopics.flatMap((s) => s.claims);
    const reportCount = getNPeopleFromReport(report);
    const claimsCount = getNPeopleFromClaims(allClaims);
    expect(claimsCount).toBe(reportCount);
  });

  test("returns 0 for empty array", () => {
    expect(getNPeopleFromClaims([])).toBe(0);
  });

  test("counts unique interviews only (deduplication)", () => {
    const allClaims = subtopics.flatMap((s) => s.claims);
    const totalPeople = getNPeopleFromClaims(allClaims);
    const sumOfSubtopics = subtopics.reduce(
      (sum, st) => sum + getNPeopleFromSubtopics([st]),
      0,
    );
    expect(totalPeople).toBeLessThanOrEqual(sumOfSubtopics);
  });
});

describe("getNClaims", () => {
  const pipelineOutput = data as { data: [unknown, schema.ReportDataObj] };
  const report = pipelineOutput.data[1];
  const subtopics = report.topics.flatMap((t) => t.subtopics);

  test("returns total claim count from subtopics", () => {
    const totalClaims = subtopics.flatMap((s) => s.claims).length;
    expect(getNClaims(subtopics)).toBe(totalClaims);
  });

  test("returns 0 for empty subtopic array", () => {
    expect(getNClaims([])).toBe(0);
  });

  test("returns 0 for subtopics with no claims", () => {
    const emptySubtopic: schema.Subtopic = {
      id: "empty",
      title: "Empty",
      description: "No claims",
      claims: [],
    };
    expect(getNClaims([emptySubtopic])).toBe(0);
  });
});

describe("getQuotes", () => {
  const pipelineOutput = data as { data: [unknown, schema.ReportDataObj] };
  const report = pipelineOutput.data[1];
  const claims = report.topics.flatMap((t) =>
    t.subtopics.flatMap((s) => s.claims),
  );

  test("returns quotes from claim", () => {
    const claimWithQuotes = claims.find((c) => c.quotes.length > 0);
    if (claimWithQuotes) {
      const quotes = getQuotes(claimWithQuotes);
      expect(quotes.length).toBeGreaterThanOrEqual(
        claimWithQuotes.quotes.length,
      );
    }
  });

  test("includes quotes from similarClaims", () => {
    const claimWithSimilar = claims.find((c) => c.similarClaims.length > 0);
    if (claimWithSimilar) {
      const quotes = getQuotes(claimWithSimilar);
      const directQuotes = claimWithSimilar.quotes.length;
      const similarQuotes = claimWithSimilar.similarClaims.flatMap(
        (sc) => sc.quotes,
      ).length;
      expect(quotes.length).toBe(directQuotes + similarQuotes);
    }
  });

  test("returns empty array for claim with no quotes", () => {
    const emptyQuotesClaim: schema.Claim = {
      id: "c1",
      title: "Test",
      quotes: [],
      similarClaims: [],
    };
    expect(getQuotes(emptyQuotesClaim)).toEqual([]);
  });
});
