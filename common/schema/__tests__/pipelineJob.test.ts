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

  describe("empty string validation for instructions", () => {
    it("should reject empty systemInstructions", () => {
      const invalid = {
        ...validPipelineJob,
        config: {
          ...validPipelineJob.config,
          instructions: {
            ...validPipelineJob.config.instructions,
            systemInstructions: "",
          },
        },
      };
      const result = pipelineJobSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "System instructions cannot be empty",
        );
      }
    });

    it("should reject empty clusteringInstructions", () => {
      const invalid = {
        ...validPipelineJob,
        config: {
          ...validPipelineJob.config,
          instructions: {
            ...validPipelineJob.config.instructions,
            clusteringInstructions: "",
          },
        },
      };
      const result = pipelineJobSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Clustering instructions cannot be empty",
        );
      }
    });

    it("should reject empty extractionInstructions", () => {
      const invalid = {
        ...validPipelineJob,
        config: {
          ...validPipelineJob.config,
          instructions: {
            ...validPipelineJob.config.instructions,
            extractionInstructions: "",
          },
        },
      };
      const result = pipelineJobSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Extraction instructions cannot be empty",
        );
      }
    });

    it("should reject empty dedupInstructions", () => {
      const invalid = {
        ...validPipelineJob,
        config: {
          ...validPipelineJob.config,
          instructions: {
            ...validPipelineJob.config.instructions,
            dedupInstructions: "",
          },
        },
      };
      const result = pipelineJobSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Dedup instructions cannot be empty",
        );
      }
    });

    it("should reject empty summariesInstructions", () => {
      const invalid = {
        ...validPipelineJob,
        config: {
          ...validPipelineJob.config,
          instructions: {
            ...validPipelineJob.config.instructions,
            summariesInstructions: "",
          },
        },
      };
      const result = pipelineJobSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Summaries instructions cannot be empty",
        );
      }
    });

    it("should reject empty cruxInstructions", () => {
      const invalid = {
        ...validPipelineJob,
        config: {
          ...validPipelineJob.config,
          instructions: {
            ...validPipelineJob.config.instructions,
            cruxInstructions: "",
          },
        },
      };
      const result = pipelineJobSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Crux instructions cannot be empty",
        );
      }
    });
  });

  describe("empty string validation for other fields", () => {
    it("should reject empty model name", () => {
      const invalid = {
        ...validPipelineJob,
        config: {
          ...validPipelineJob.config,
          llm: {
            model: "",
          },
        },
      };
      const result = pipelineJobSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Model name cannot be empty",
        );
      }
    });

    it("should reject empty API key", () => {
      const invalid = {
        ...validPipelineJob,
        config: {
          ...validPipelineJob.config,
          env: {
            OPENAI_API_KEY: "",
          },
        },
      };
      const result = pipelineJobSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("API key cannot be empty");
      }
    });

    it("should reject empty reportId", () => {
      const invalid = {
        ...validPipelineJob,
        config: {
          ...validPipelineJob.config,
          firebaseDetails: {
            ...validPipelineJob.config.firebaseDetails,
            reportId: "",
          },
        },
      };
      const result = pipelineJobSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Report ID cannot be empty",
        );
      }
    });

    it("should reject empty userId", () => {
      const invalid = {
        ...validPipelineJob,
        config: {
          ...validPipelineJob.config,
          firebaseDetails: {
            ...validPipelineJob.config.firebaseDetails,
            userId: "",
          },
        },
      };
      const result = pipelineJobSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("User ID cannot be empty");
      }
    });

    it("should reject empty title", () => {
      const invalid = {
        ...validPipelineJob,
        reportDetails: {
          ...validPipelineJob.reportDetails,
          title: "",
        },
      };
      const result = pipelineJobSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Title cannot be empty");
      }
    });

    it("should reject empty description", () => {
      const invalid = {
        ...validPipelineJob,
        reportDetails: {
          ...validPipelineJob.reportDetails,
          description: "",
        },
      };
      const result = pipelineJobSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Description cannot be empty",
        );
      }
    });

    it("should reject empty question", () => {
      const invalid = {
        ...validPipelineJob,
        reportDetails: {
          ...validPipelineJob.reportDetails,
          question: "",
        },
      };
      const result = pipelineJobSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Question cannot be empty");
      }
    });

    it("should reject empty filename", () => {
      const invalid = {
        ...validPipelineJob,
        reportDetails: {
          ...validPipelineJob.reportDetails,
          filename: "",
        },
      };
      const result = pipelineJobSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Filename cannot be empty");
      }
    });
  });

  describe("empty string validation for comment data", () => {
    it("should reject empty comment_id", () => {
      const invalid = {
        ...validPipelineJob,
        data: [
          {
            comment_id: "",
            comment_text: "Valid text",
            speaker: "participant",
          },
        ],
      };
      const result = pipelineJobSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Comment ID cannot be empty",
        );
      }
    });

    it("should reject empty comment_text", () => {
      const invalid = {
        ...validPipelineJob,
        data: [
          {
            comment_id: "comment-1",
            comment_text: "",
            speaker: "participant",
          },
        ],
      };
      const result = pipelineJobSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Comment text cannot be empty",
        );
      }
    });
  });
});
