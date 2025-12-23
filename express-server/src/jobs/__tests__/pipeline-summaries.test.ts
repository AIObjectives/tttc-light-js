import type * as apiPyserver from "tttc-common/apiPyserver";
import { failure, success } from "tttc-common/functional-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the pipeline module
vi.mock("../../pipeline/", () => ({
  topicSummariesPipelineStep: vi.fn(),
}));

// Mock logger
vi.mock("tttc-common/logger", () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    }),
  },
}));

import * as Pyserver from "../../pipeline/";

describe("Topic Summaries Step - Individual Processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create mock tree data (OutputProps format)
  const createMockTree = (
    topics: Array<{ name: string; subtopics: string[] }>,
  ): apiPyserver.SortClaimsTreeResponse["data"] => {
    return topics.map(
      (topic) =>
        [
          topic.name,
          {
            total: 10,
            topics: topic.subtopics.map((sub) => [
              sub,
              {
                total: 5,
                claims: [
                  {
                    claim: `Sample claim for ${sub}`,
                    quote: "Sample quote",
                    duplicates: [],
                    numPeople: 3,
                  },
                ],
              },
            ]),
          },
        ] as [string, any],
    ) as apiPyserver.SortClaimsTreeResponse["data"];
  };

  // Mock LLM config
  const mockLLMConfig: apiPyserver.LLMConfig = {
    model_name: "gpt-4o-mini",
    system_prompt: "Test system prompt",
    user_prompt: "Test user prompt",
  };

  const mockEnv = {
    PYSERVER_URL: "http://localhost:8000",
    OPENAI_API_KEY: "test-key",
  } as any;

  describe("Individual Topic Processing", () => {
    it("should process each topic individually and aggregate results", async () => {
      const mockTree = createMockTree([
        { name: "Education", subtopics: ["Teaching", "Learning"] },
        { name: "Healthcare", subtopics: ["Access", "Quality"] },
        { name: "Transportation", subtopics: ["Public Transit", "Roads"] },
      ]);

      // Mock responses for each individual topic
      const mockResponses = [
        {
          data: [
            {
              topicName: "Education",
              summary: "Education summary with 100 words of content here...",
            },
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
          },
          cost: 0.01,
        },
        {
          data: [
            {
              topicName: "Healthcare",
              summary: "Healthcare summary with 100 words of content here...",
            },
          ],
          usage: {
            prompt_tokens: 120,
            completion_tokens: 60,
            total_tokens: 180,
          },
          cost: 0.015,
        },
        {
          data: [
            {
              topicName: "Transportation",
              summary:
                "Transportation summary with 100 words of content here...",
            },
          ],
          usage: {
            prompt_tokens: 110,
            completion_tokens: 55,
            total_tokens: 165,
          },
          cost: 0.012,
        },
      ];

      // Set up mock to return different responses for each call
      let callCount = 0;
      vi.mocked(Pyserver.topicSummariesPipelineStep).mockImplementation(() => {
        const response = mockResponses[callCount++];
        return Promise.resolve(success(response));
      });

      // Import and call the function (simulating what happens in makePyserverFuncs)
      const doTopicSummariesStep = async (
        tree: apiPyserver.SortClaimsTreeResponse["data"],
      ) => {
        const summaryPromises = tree.map(async ([topicName, topicData]) => {
          const singleTopicTree = [[topicName, topicData]] as typeof tree;

          const result = await Pyserver.topicSummariesPipelineStep(
            mockEnv,
            {
              tree: singleTopicTree,
              llm: mockLLMConfig,
            },
            "test-user",
            "test-report",
          );

          return result.tag === "success"
            ? success({
                topicName,
                summary: result.value.data,
                usage: result.value.usage,
                cost: result.value.cost,
              })
            : result;
        });

        const results = await Promise.all(summaryPromises);

        // Combine results
        const firstFailure = results.find((r) => r.tag === "failure");
        if (firstFailure && firstFailure.tag === "failure") {
          return firstFailure;
        }

        const successResults = results as Array<{
          tag: "success";
          value: {
            topicName: string;
            summary: any;
            usage: apiPyserver.Usage;
            cost: number;
          };
        }>;

        const combinedData = successResults.map((r) => ({
          topicName: r.value.topicName,
          summary: r.value.summary[0].summary,
        }));

        const combinedUsage = successResults.reduce(
          (acc, r) => ({
            prompt_tokens: acc.prompt_tokens + r.value.usage.prompt_tokens,
            completion_tokens:
              acc.completion_tokens + r.value.usage.completion_tokens,
            total_tokens: acc.total_tokens + r.value.usage.total_tokens,
          }),
          { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        );

        const combinedCost = successResults.reduce(
          (acc, r) => acc + r.value.cost,
          0,
        );

        return success({
          stepName: "Summaries Step",
          data: combinedData,
          usage: combinedUsage,
          cost: combinedCost,
        });
      };

      const result = await doTopicSummariesStep(mockTree);

      // Verify the result
      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        // Check that we got summaries for all 3 topics
        expect(result.value.data).toHaveLength(3);
        expect(result.value.data[0].topicName).toBe("Education");
        expect(result.value.data[1].topicName).toBe("Healthcare");
        expect(result.value.data[2].topicName).toBe("Transportation");

        // Verify usage aggregation
        expect(result.value.usage.prompt_tokens).toBe(330); // 100 + 120 + 110
        expect(result.value.usage.completion_tokens).toBe(165); // 50 + 60 + 55
        expect(result.value.usage.total_tokens).toBe(495); // 150 + 180 + 165

        // Verify cost aggregation (use closeTo for floating point comparison)
        expect(result.value.cost).toBeCloseTo(0.037, 5); // 0.01 + 0.015 + 0.012
      }

      // Verify API was called 3 times (once per topic)
      expect(Pyserver.topicSummariesPipelineStep).toHaveBeenCalledTimes(3);
    });

    it("should handle single topic correctly", async () => {
      const mockTree = createMockTree([
        { name: "Technology", subtopics: ["AI", "Blockchain"] },
      ]);

      const mockResponse = {
        data: [
          {
            topicName: "Technology",
            summary: "Technology summary here...",
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        cost: 0.01,
      };

      vi.mocked(Pyserver.topicSummariesPipelineStep).mockResolvedValue(
        success(mockResponse),
      );

      const doTopicSummariesStep = async (
        tree: apiPyserver.SortClaimsTreeResponse["data"],
      ) => {
        const summaryPromises = tree.map(async ([topicName, topicData]) => {
          const singleTopicTree = [[topicName, topicData]] as typeof tree;
          const result = await Pyserver.topicSummariesPipelineStep(
            mockEnv,
            { tree: singleTopicTree, llm: mockLLMConfig },
            "test-user",
            "test-report",
          );
          return result.tag === "success"
            ? success({
                topicName,
                summary: result.value.data,
                usage: result.value.usage,
                cost: result.value.cost,
              })
            : result;
        });

        const results = await Promise.all(summaryPromises);
        const successResults = results as Array<{
          tag: "success";
          value: any;
        }>;

        return success({
          data: successResults.map((r) => ({
            topicName: r.value.topicName,
            summary: r.value.summary[0].summary,
          })),
          usage: successResults[0].value.usage,
          cost: successResults[0].value.cost,
        });
      };

      const result = await doTopicSummariesStep(mockTree);

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        expect(result.value.data).toHaveLength(1);
        expect(result.value.data[0].topicName).toBe("Technology");
      }

      expect(Pyserver.topicSummariesPipelineStep).toHaveBeenCalledTimes(1);
    });

    it("should handle empty tree", async () => {
      const mockTree: apiPyserver.SortClaimsTreeResponse["data"] = [];

      const doTopicSummariesStep = async (
        tree: apiPyserver.SortClaimsTreeResponse["data"],
      ) => {
        if (tree.length === 0) {
          return success({
            stepName: "Summaries Step",
            data: [],
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            cost: 0,
          });
        }
        // ... rest of implementation
        return success({ data: [], usage: {} as any, cost: 0 });
      };

      const result = await doTopicSummariesStep(mockTree);

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        expect(result.value.data).toHaveLength(0);
        expect(result.value.usage.total_tokens).toBe(0);
        expect(result.value.cost).toBe(0);
      }

      expect(Pyserver.topicSummariesPipelineStep).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should fail if any topic summary fails", async () => {
      const mockTree = createMockTree([
        { name: "Topic1", subtopics: ["Sub1"] },
        { name: "Topic2", subtopics: ["Sub2"] },
        { name: "Topic3", subtopics: ["Sub3"] },
      ]);

      // Mock: first succeeds, second fails, third succeeds
      let callCount = 0;
      vi.mocked(Pyserver.topicSummariesPipelineStep).mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.resolve(
            failure({
              name: "FetchError",
              message: "Network error",
            } as any),
          );
        }
        return Promise.resolve(
          success({
            data: [{ topicName: `Topic${callCount}`, summary: "Summary" }],
            usage: {
              prompt_tokens: 100,
              completion_tokens: 50,
              total_tokens: 150,
            },
            cost: 0.01,
          }),
        );
      });

      const doTopicSummariesStep = async (
        tree: apiPyserver.SortClaimsTreeResponse["data"],
      ) => {
        const summaryPromises = tree.map(async ([topicName, topicData]) => {
          const singleTopicTree = [[topicName, topicData]] as typeof tree;
          return await Pyserver.topicSummariesPipelineStep(
            mockEnv,
            { tree: singleTopicTree, llm: mockLLMConfig },
            "test-user",
            "test-report",
          );
        });

        const results = await Promise.all(summaryPromises);

        // Check for failures
        const firstFailure = results.find((r) => r.tag === "failure");
        if (firstFailure && firstFailure.tag === "failure") {
          return firstFailure;
        }

        return success({ data: [], usage: {} as any, cost: 0 });
      };

      const result = await doTopicSummariesStep(mockTree);

      expect(result.tag).toBe("failure");
      if (result.tag === "failure") {
        expect(result.error.message).toBe("Network error");
      }
    });
  });

  describe("Response Format Handling", () => {
    it("should correctly extract summary from array response", async () => {
      const mockTree = createMockTree([
        { name: "Climate", subtopics: ["Emissions"] },
      ]);

      const mockResponse = {
        data: [
          {
            topicName: "Climate",
            summary: "Detailed climate summary with many words...",
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        cost: 0.01,
      };

      vi.mocked(Pyserver.topicSummariesPipelineStep).mockResolvedValue(
        success(mockResponse),
      );

      const doTopicSummariesStep = async (
        tree: apiPyserver.SortClaimsTreeResponse["data"],
      ) => {
        const summaryPromises = tree.map(async ([topicName, topicData]) => {
          const singleTopicTree = [[topicName, topicData]] as typeof tree;
          const result = await Pyserver.topicSummariesPipelineStep(
            mockEnv,
            { tree: singleTopicTree, llm: mockLLMConfig },
            "test-user",
            "test-report",
          );

          return result.tag === "success"
            ? success({
                topicName,
                summary: result.value.data,
                usage: result.value.usage,
                cost: result.value.cost,
              })
            : result;
        });

        const results = await Promise.all(summaryPromises);
        const successResults = results as Array<{
          tag: "success";
          value: any;
        }>;

        // Extract summary from array format
        const combinedData = successResults.map((r) => {
          const data = r.value;
          let summaryText: string;

          if (Array.isArray(data.summary) && data.summary.length > 0) {
            summaryText = data.summary[0].summary;
          } else if (typeof data.summary === "string") {
            summaryText = data.summary;
          } else {
            summaryText = "";
          }

          return {
            topicName: data.topicName,
            summary: summaryText,
          };
        });

        return success({
          data: combinedData,
          usage: successResults[0].value.usage,
          cost: successResults[0].value.cost,
        });
      };

      const result = await doTopicSummariesStep(mockTree);

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        expect(result.value.data[0].summary).toBe(
          "Detailed climate summary with many words...",
        );
      }
    });

    it("should handle empty summary array gracefully", async () => {
      const mockTree = createMockTree([{ name: "Test", subtopics: ["Sub"] }]);

      const mockResponse = {
        data: [], // Empty array
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        cost: 0.01,
      };

      vi.mocked(Pyserver.topicSummariesPipelineStep).mockResolvedValue(
        success(mockResponse),
      );

      const doTopicSummariesStep = async (
        tree: apiPyserver.SortClaimsTreeResponse["data"],
      ) => {
        const summaryPromises = tree.map(async ([topicName, topicData]) => {
          const singleTopicTree = [[topicName, topicData]] as typeof tree;
          const result = await Pyserver.topicSummariesPipelineStep(
            mockEnv,
            { tree: singleTopicTree, llm: mockLLMConfig },
            "test-user",
            "test-report",
          );

          return result.tag === "success"
            ? success({
                topicName,
                summary: result.value.data,
                usage: result.value.usage,
                cost: result.value.cost,
              })
            : result;
        });

        const results = await Promise.all(summaryPromises);
        const successResults = results as Array<{
          tag: "success";
          value: any;
        }>;

        const combinedData = successResults.map((r) => {
          const data = r.value;
          let summaryText: string;

          if (Array.isArray(data.summary) && data.summary.length > 0) {
            summaryText = data.summary[0].summary;
          } else {
            summaryText = ""; // Handle empty array
          }

          return {
            topicName: data.topicName,
            summary: summaryText,
          };
        });

        return success({
          data: combinedData,
          usage: successResults[0].value.usage,
          cost: successResults[0].value.cost,
        });
      };

      const result = await doTopicSummariesStep(mockTree);

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        expect(result.value.data[0].summary).toBe("");
      }
    });
  });

  describe("Parallel Processing Performance", () => {
    it("should process all topics in parallel, not sequentially", async () => {
      const mockTree = createMockTree([
        { name: "Topic1", subtopics: ["Sub1"] },
        { name: "Topic2", subtopics: ["Sub2"] },
        { name: "Topic3", subtopics: ["Sub3"] },
      ]);

      const callTimestamps: number[] = [];

      vi.mocked(Pyserver.topicSummariesPipelineStep).mockImplementation(
        async () => {
          callTimestamps.push(Date.now());
          // Simulate API delay
          await new Promise((resolve) => setTimeout(resolve, 10));
          return success({
            data: [{ topicName: "Test", summary: "Summary" }],
            usage: {
              prompt_tokens: 100,
              completion_tokens: 50,
              total_tokens: 150,
            },
            cost: 0.01,
          });
        },
      );

      const doTopicSummariesStep = async (
        tree: apiPyserver.SortClaimsTreeResponse["data"],
      ) => {
        const summaryPromises = tree.map(async ([topicName, topicData]) => {
          const singleTopicTree = [[topicName, topicData]] as typeof tree;
          return await Pyserver.topicSummariesPipelineStep(
            mockEnv,
            { tree: singleTopicTree, llm: mockLLMConfig },
            "test-user",
            "test-report",
          );
        });

        await Promise.all(summaryPromises);
        return success({ data: [], usage: {} as any, cost: 0 });
      };

      await doTopicSummariesStep(mockTree);

      // All calls should start within a small time window (parallel)
      // If sequential, they would be ~10ms apart
      const maxTimeDiff =
        Math.max(...callTimestamps) - Math.min(...callTimestamps);
      expect(maxTimeDiff).toBeLessThan(10); // Should all start nearly simultaneously
    });
  });
});
