// @codescene(disable:"Code Duplication") <-- reason:"Validation test cases require similar structure for comprehensive coverage"
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
        id: "comment-1",
        comment: "This is a test comment",
        interview: "participant",
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

    it("should accept pipeline job data without cruxInstructions when cruxes disabled", () => {
      const jobWithoutCruxInstructions = {
        ...validPipelineJob,
        config: {
          ...validPipelineJob.config,
          instructions: {
            ...validPipelineJob.config.instructions,
            cruxInstructions: undefined,
          },
          options: {
            ...validPipelineJob.config.options,
            cruxes: false,
          },
        },
      };
      const result = pipelineJobSchema.safeParse(jobWithoutCruxInstructions);
      expect(result.success).toBe(true);
    });

    it("should accept pipeline job data with empty cruxInstructions when cruxes disabled", () => {
      const jobWithEmptyCruxInstructions = {
        ...validPipelineJob,
        config: {
          ...validPipelineJob.config,
          instructions: {
            ...validPipelineJob.config.instructions,
            cruxInstructions: "",
          },
          options: {
            ...validPipelineJob.config.options,
            cruxes: false,
          },
        },
      };
      const result = pipelineJobSchema.safeParse(jobWithEmptyCruxInstructions);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Crux instructions cannot be empty",
        );
      }
    });
  });

  describe("empty string validation", () => {
    const emptyStringTestCases: Array<{
      name: string;
      path: string[];
      expectedError: string;
    }> = [
      {
        name: "systemInstructions",
        path: ["config", "instructions", "systemInstructions"],
        expectedError: "System instructions cannot be empty",
      },
      {
        name: "clusteringInstructions",
        path: ["config", "instructions", "clusteringInstructions"],
        expectedError: "Clustering instructions cannot be empty",
      },
      {
        name: "extractionInstructions",
        path: ["config", "instructions", "extractionInstructions"],
        expectedError: "Extraction instructions cannot be empty",
      },
      {
        name: "dedupInstructions",
        path: ["config", "instructions", "dedupInstructions"],
        expectedError: "Dedup instructions cannot be empty",
      },
      {
        name: "summariesInstructions",
        path: ["config", "instructions", "summariesInstructions"],
        expectedError: "Summaries instructions cannot be empty",
      },
      {
        name: "model name",
        path: ["config", "llm", "model"],
        expectedError: "Model name cannot be empty",
      },
      {
        name: "API key",
        path: ["config", "env", "OPENAI_API_KEY"],
        expectedError: "API key cannot be empty",
      },
      {
        name: "reportId",
        path: ["config", "firebaseDetails", "reportId"],
        expectedError: "Report ID cannot be empty",
      },
      {
        name: "userId",
        path: ["config", "firebaseDetails", "userId"],
        expectedError: "User ID cannot be empty",
      },
      {
        name: "title",
        path: ["reportDetails", "title"],
        expectedError: "Title cannot be empty",
      },
      {
        name: "description",
        path: ["reportDetails", "description"],
        expectedError: "Description cannot be empty",
      },
      {
        name: "question",
        path: ["reportDetails", "question"],
        expectedError: "Question cannot be empty",
      },
      {
        name: "filename",
        path: ["reportDetails", "filename"],
        expectedError: "Filename cannot be empty",
      },
    ];

    const commentFieldTestCases: Array<{
      name: string;
      field: "id" | "comment";
      expectedError: string;
    }> = [
      {
        name: "id",
        field: "id",
        expectedError: "Comment ID cannot be empty",
      },
      {
        name: "comment",
        field: "comment",
        expectedError: "Comment text cannot be empty",
      },
    ];

    function setNestedValue(
      obj: unknown,
      path: string[],
      value: unknown,
    ): unknown {
      if (path.length === 0) return value;
      const [head, ...tail] = path;
      return {
        ...(obj as Record<string, unknown>),
        [head]: setNestedValue(
          (obj as Record<string, unknown>)[head],
          tail,
          value,
        ),
      };
    }

    it.each(emptyStringTestCases)("should reject empty $name", ({
      path,
      expectedError,
    }) => {
      const invalid = setNestedValue(validPipelineJob, path, "");
      const result = pipelineJobSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(expectedError);
      }
    });

    it.each(commentFieldTestCases)("should reject empty $name", ({
      field,
      expectedError,
    }) => {
      const invalid = {
        ...validPipelineJob,
        data: [
          {
            id: field === "id" ? "" : "comment-1",
            comment: field === "comment" ? "" : "Valid text",
            interview: "participant",
          },
        ],
      };
      const result = pipelineJobSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(expectedError);
      }
    });
  });
});
