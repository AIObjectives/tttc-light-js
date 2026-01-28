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

  function testEmptyStringRejection(
    testName: string,
    createInvalidData: (base: typeof validPipelineJob) => unknown,
    expectedErrorMessage: string,
  ) {
    it(testName, () => {
      const invalid = createInvalidData(validPipelineJob);
      const result = pipelineJobSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(expectedErrorMessage);
      }
    });
  }

  describe("valid data", () => {
    it("should accept valid pipeline job data", () => {
      const result = pipelineJobSchema.safeParse(validPipelineJob);
      expect(result.success).toBe(true);
    });
  });

  describe("empty string validation for instructions", () => {
    testEmptyStringRejection(
      "should reject empty systemInstructions",
      (base) => ({
        ...base,
        config: {
          ...base.config,
          instructions: {
            ...base.config.instructions,
            systemInstructions: "",
          },
        },
      }),
      "System instructions cannot be empty",
    );

    testEmptyStringRejection(
      "should reject empty clusteringInstructions",
      (base) => ({
        ...base,
        config: {
          ...base.config,
          instructions: {
            ...base.config.instructions,
            clusteringInstructions: "",
          },
        },
      }),
      "Clustering instructions cannot be empty",
    );

    testEmptyStringRejection(
      "should reject empty extractionInstructions",
      (base) => ({
        ...base,
        config: {
          ...base.config,
          instructions: {
            ...base.config.instructions,
            extractionInstructions: "",
          },
        },
      }),
      "Extraction instructions cannot be empty",
    );

    testEmptyStringRejection(
      "should reject empty dedupInstructions",
      (base) => ({
        ...base,
        config: {
          ...base.config,
          instructions: {
            ...base.config.instructions,
            dedupInstructions: "",
          },
        },
      }),
      "Dedup instructions cannot be empty",
    );

    testEmptyStringRejection(
      "should reject empty summariesInstructions",
      (base) => ({
        ...base,
        config: {
          ...base.config,
          instructions: {
            ...base.config.instructions,
            summariesInstructions: "",
          },
        },
      }),
      "Summaries instructions cannot be empty",
    );

    testEmptyStringRejection(
      "should reject empty cruxInstructions",
      (base) => ({
        ...base,
        config: {
          ...base.config,
          instructions: {
            ...base.config.instructions,
            cruxInstructions: "",
          },
        },
      }),
      "Crux instructions cannot be empty",
    );
  });

  describe("empty string validation for other fields", () => {
    testEmptyStringRejection(
      "should reject empty model name",
      (base) => ({
        ...base,
        config: {
          ...base.config,
          llm: {
            model: "",
          },
        },
      }),
      "Model name cannot be empty",
    );

    testEmptyStringRejection(
      "should reject empty API key",
      (base) => ({
        ...base,
        config: {
          ...base.config,
          env: {
            OPENAI_API_KEY: "",
          },
        },
      }),
      "API key cannot be empty",
    );

    testEmptyStringRejection(
      "should reject empty reportId",
      (base) => ({
        ...base,
        config: {
          ...base.config,
          firebaseDetails: {
            ...base.config.firebaseDetails,
            reportId: "",
          },
        },
      }),
      "Report ID cannot be empty",
    );

    testEmptyStringRejection(
      "should reject empty userId",
      (base) => ({
        ...base,
        config: {
          ...base.config,
          firebaseDetails: {
            ...base.config.firebaseDetails,
            userId: "",
          },
        },
      }),
      "User ID cannot be empty",
    );

    testEmptyStringRejection(
      "should reject empty title",
      (base) => ({
        ...base,
        reportDetails: {
          ...base.reportDetails,
          title: "",
        },
      }),
      "Title cannot be empty",
    );

    testEmptyStringRejection(
      "should reject empty description",
      (base) => ({
        ...base,
        reportDetails: {
          ...base.reportDetails,
          description: "",
        },
      }),
      "Description cannot be empty",
    );

    testEmptyStringRejection(
      "should reject empty question",
      (base) => ({
        ...base,
        reportDetails: {
          ...base.reportDetails,
          question: "",
        },
      }),
      "Question cannot be empty",
    );

    testEmptyStringRejection(
      "should reject empty filename",
      (base) => ({
        ...base,
        reportDetails: {
          ...base.reportDetails,
          filename: "",
        },
      }),
      "Filename cannot be empty",
    );
  });

  describe("empty string validation for comment data", () => {
    testEmptyStringRejection(
      "should reject empty comment_id",
      (base) => ({
        ...base,
        data: [
          {
            comment_id: "",
            comment_text: "Valid text",
            speaker: "participant",
          },
        ],
      }),
      "Comment ID cannot be empty",
    );

    testEmptyStringRejection(
      "should reject empty comment_text",
      (base) => ({
        ...base,
        data: [
          {
            comment_id: "comment-1",
            comment_text: "",
            speaker: "participant",
          },
        ],
      }),
      "Comment text cannot be empty",
    );
  });
});
