import { describe, expect, it } from "vitest";
import { pipelineJobSchema } from "../pipelineJob";

describe("pipelineJobSchema validation", () => {
  const validPipelineJob = {
    config: {
      firebaseDetails: {
        reportId: "report-123",
        userId: "user-456",
      },
      llm: {
        model: "gpt-4",
      },
      instructions: {
        systemInstructions: "You are a helpful assistant",
        clusteringInstructions: "Cluster the comments",
        extractionInstructions: "Extract claims",
        dedupInstructions: "Remove duplicates",
        summariesInstructions: "Generate summaries",
        cruxInstructions: "Find cruxes",
        outputLanguage: "English",
      },
      options: {
        cruxes: true,
        bridging: false,
        sortStrategy: "numPeople" as const,
      },
      env: {
        OPENAI_API_KEY: "sk-test-key",
      },
    },
    data: [
      {
        comment_id: "comment-1",
        comment_text: "This is a test comment",
        speaker: "participant",
      },
    ],
    reportDetails: {
      title: "Test Report",
      description: "A test report description",
      question: "What do you think?",
      filename: "test-report.json",
    },
  };

  describe("valid data", () => {
    it("should accept valid pipeline job data", () => {
      const result = pipelineJobSchema.safeParse(validPipelineJob);
      expect(result.success).toBe(true);
    });
  });

  describe("empty string validation", () => {
    // codescene:ignore-start - Validation test cases require similar structure
    const emptyStringTestCases: Array<{
      name: string;
      createInvalidData: (base: typeof validPipelineJob) => unknown;
      expectedError: string;
    }> = [
      {
        name: "systemInstructions",
        createInvalidData: (base) => ({
          ...base,
          config: {
            ...base.config,
            instructions: {
              ...base.config.instructions,
              systemInstructions: "",
            },
          },
        }),
        expectedError: "System instructions cannot be empty",
      },
      {
        name: "clusteringInstructions",
        createInvalidData: (base) => ({
          ...base,
          config: {
            ...base.config,
            instructions: {
              ...base.config.instructions,
              clusteringInstructions: "",
            },
          },
        }),
        expectedError: "Clustering instructions cannot be empty",
      },
      {
        name: "extractionInstructions",
        createInvalidData: (base) => ({
          ...base,
          config: {
            ...base.config,
            instructions: {
              ...base.config.instructions,
              extractionInstructions: "",
            },
          },
        }),
        expectedError: "Extraction instructions cannot be empty",
      },
      {
        name: "dedupInstructions",
        createInvalidData: (base) => ({
          ...base,
          config: {
            ...base.config,
            instructions: {
              ...base.config.instructions,
              dedupInstructions: "",
            },
          },
        }),
        expectedError: "Dedup instructions cannot be empty",
      },
      {
        name: "summariesInstructions",
        createInvalidData: (base) => ({
          ...base,
          config: {
            ...base.config,
            instructions: {
              ...base.config.instructions,
              summariesInstructions: "",
            },
          },
        }),
        expectedError: "Summaries instructions cannot be empty",
      },
      {
        name: "cruxInstructions",
        createInvalidData: (base) => ({
          ...base,
          config: {
            ...base.config,
            instructions: {
              ...base.config.instructions,
              cruxInstructions: "",
            },
          },
        }),
        expectedError: "Crux instructions cannot be empty",
      },
      {
        name: "model name",
        createInvalidData: (base) => ({
          ...base,
          config: {
            ...base.config,
            llm: {
              model: "",
            },
          },
        }),
        expectedError: "Model name cannot be empty",
      },
      {
        name: "API key",
        createInvalidData: (base) => ({
          ...base,
          config: {
            ...base.config,
            env: {
              OPENAI_API_KEY: "",
            },
          },
        }),
        expectedError: "API key cannot be empty",
      },
      {
        name: "reportId",
        createInvalidData: (base) => ({
          ...base,
          config: {
            ...base.config,
            firebaseDetails: {
              ...base.config.firebaseDetails,
              reportId: "",
            },
          },
        }),
        expectedError: "Report ID cannot be empty",
      },
      {
        name: "userId",
        createInvalidData: (base) => ({
          ...base,
          config: {
            ...base.config,
            firebaseDetails: {
              ...base.config.firebaseDetails,
              userId: "",
            },
          },
        }),
        expectedError: "User ID cannot be empty",
      },
      {
        name: "title",
        createInvalidData: (base) => ({
          ...base,
          reportDetails: {
            ...base.reportDetails,
            title: "",
          },
        }),
        expectedError: "Title cannot be empty",
      },
      {
        name: "description",
        createInvalidData: (base) => ({
          ...base,
          reportDetails: {
            ...base.reportDetails,
            description: "",
          },
        }),
        expectedError: "Description cannot be empty",
      },
      {
        name: "question",
        createInvalidData: (base) => ({
          ...base,
          reportDetails: {
            ...base.reportDetails,
            question: "",
          },
        }),
        expectedError: "Question cannot be empty",
      },
      {
        name: "filename",
        createInvalidData: (base) => ({
          ...base,
          reportDetails: {
            ...base.reportDetails,
            filename: "",
          },
        }),
        expectedError: "Filename cannot be empty",
      },
      {
        name: "comment_id",
        createInvalidData: (base) => ({
          ...base,
          data: [
            {
              comment_id: "",
              comment_text: "Valid text",
              speaker: "participant",
            },
          ],
        }),
        expectedError: "Comment ID cannot be empty",
      },
      {
        name: "comment_text",
        createInvalidData: (base) => ({
          ...base,
          data: [
            {
              comment_id: "comment-1",
              comment_text: "",
              speaker: "participant",
            },
          ],
        }),
        expectedError: "Comment text cannot be empty",
      },
    ];
    // codescene:ignore-end

    it.each(emptyStringTestCases)("should reject empty $name", ({
      createInvalidData,
      expectedError,
    }) => {
      const invalid = createInvalidData(validPipelineJob);
      const result = pipelineJobSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(expectedError);
      }
    });
  });
});
