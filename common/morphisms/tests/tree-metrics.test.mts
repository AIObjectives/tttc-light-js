import { test, expect, beforeAll, describe } from "vitest";
import * as schema from "../../schema.js";
import { z } from "zod";
import { getNPeople } from "../tree-metrics.js";
const data = require("./data/getNPeople.json");

function isJsonString(str: string) {
  try {
    JSON.stringify(str);
  } catch (e) {
    return false;
  }
  return true;
}

describe("Test to make sure test data is valid", () => {
  test("Is valid json", () => {
    expect(isJsonString(data)).true;
  });

  test("Is report data", () => {
    expect(schema.pipelineOutput.safeParse(data).success).true;
  });
});

describe("getNPeople", () => {
  const pipelineOutput = schema.pipelineOutput.parse(data);
  const report = pipelineOutput.data[1];
  const topics = report.topics;
  const subtopics = topics.flatMap((t) => t.subtopics);

  test("Gets correct number of people from report", () => {
    expect(getNPeople(report)).toBe(8);
  });

  test("Gets correct number of people from topics", () => {
    expect(getNPeople([topics[0]])).toBe(5);
    expect(getNPeople([topics[1]])).toBe(3);
  });

  test("Gets correct number of people from subtopics", () => {
    expect(getNPeople([subtopics[0]])).toBe(3);
    expect(getNPeople([subtopics[1]])).toBe(2);
    expect(getNPeople([subtopics[2]])).toBe(3);
    expect(getNPeople([subtopics[3]])).toBe(0);
  });

  // The rest is trivial
});
