import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { type LLMClaim, llmClaim } from "../index";

describe("llmClaim schema validation", () => {
  describe("valid claims", () => {
    it("should accept a minimal valid claim", () => {
      const validClaim = {
        claim: "AI will transform healthcare",
        quote: "I believe AI will completely change how we deliver healthcare",
        topicName: "Healthcare",
      };

      const result = llmClaim.parse(validClaim);

      expect(result.claim).toBe("AI will transform healthcare");
      expect(result.quote).toBe(
        "I believe AI will completely change how we deliver healthcare",
      );
      expect(result.topicName).toBe("Healthcare");
    });

    it("should accept a claim with all optional fields", () => {
      const fullClaim = {
        claim: "AI will transform healthcare",
        quote: "I believe AI will completely change how we deliver healthcare",
        topicName: "Healthcare",
        claimId: "claim-123",
        subtopicName: "AI in Medicine",
        commentId: "comment-456",
        duplicated: false,
      };

      const result = llmClaim.parse(fullClaim);

      expect(result.claimId).toBe("claim-123");
      expect(result.subtopicName).toBe("AI in Medicine");
      expect(result.commentId).toBe("comment-456");
      expect(result.duplicated).toBe(false);
    });

    it("should accept a claim with nested duplicates", () => {
      const claimWithDuplicates: LLMClaim = {
        claim: "AI will transform healthcare",
        quote: "I believe AI will completely change how we deliver healthcare",
        topicName: "Healthcare",
        duplicates: [
          {
            claim: "AI will revolutionize medicine",
            quote: "Medical AI is going to be revolutionary",
            topicName: "Healthcare",
            duplicated: true,
          },
        ],
      };

      const result = llmClaim.parse(claimWithDuplicates);

      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates?.[0].claim).toBe(
        "AI will revolutionize medicine",
      );
      expect(result.duplicates?.[0].duplicated).toBe(true);
    });

    it("should accept deeply nested duplicates", () => {
      const deeplyNested: LLMClaim = {
        claim: "Level 1",
        quote: "Quote 1",
        topicName: "Topic",
        duplicates: [
          {
            claim: "Level 2",
            quote: "Quote 2",
            topicName: "Topic",
            duplicates: [
              {
                claim: "Level 3",
                quote: "Quote 3",
                topicName: "Topic",
              },
            ],
          },
        ],
      };

      const result = llmClaim.parse(deeplyNested);

      expect(result.duplicates?.[0].duplicates?.[0].claim).toBe("Level 3");
    });
  });

  describe("malformed claims - should throw ZodError", () => {
    it("should reject a claim with wrong shape entirely", () => {
      const wrongShape = { wrong: "shape" };

      expect(() => llmClaim.parse(wrongShape)).toThrow(ZodError);
    });

    it("should reject a claim with wrong type for claim field", () => {
      const wrongType = {
        claim: 123, // should be string
        quote: "Valid quote",
        topicName: "Topic",
      };

      expect(() => llmClaim.parse(wrongType)).toThrow(ZodError);
    });

    it("should reject a claim with empty claim text", () => {
      const emptyClaim = {
        claim: "", // empty string should fail min(1)
        quote: "Valid quote",
        topicName: "Topic",
      };

      expect(() => llmClaim.parse(emptyClaim)).toThrow(ZodError);

      try {
        llmClaim.parse(emptyClaim);
      } catch (e) {
        if (e instanceof ZodError) {
          expect(e.errors[0].message).toBe("Claim text cannot be empty");
        }
      }
    });

    it("should reject a claim with empty quote text", () => {
      const emptyQuote = {
        claim: "Valid claim",
        quote: "", // empty string should fail min(1)
        topicName: "Topic",
      };

      expect(() => llmClaim.parse(emptyQuote)).toThrow(ZodError);

      try {
        llmClaim.parse(emptyQuote);
      } catch (e) {
        if (e instanceof ZodError) {
          expect(e.errors[0].message).toBe("Quote text cannot be empty");
        }
      }
    });

    it("should reject a claim with empty topic name", () => {
      const emptyTopic = {
        claim: "Valid claim",
        quote: "Valid quote",
        topicName: "", // empty string should fail min(1)
      };

      expect(() => llmClaim.parse(emptyTopic)).toThrow(ZodError);

      try {
        llmClaim.parse(emptyTopic);
      } catch (e) {
        if (e instanceof ZodError) {
          expect(e.errors[0].message).toBe("Topic name cannot be empty");
        }
      }
    });

    it("should reject a claim with missing required fields", () => {
      const missingFields = {
        claim: "Only claim provided",
        // missing quote and topicName
      };

      expect(() => llmClaim.parse(missingFields)).toThrow(ZodError);
    });

    it("should reject a claim with null values for required fields", () => {
      const nullValues = {
        claim: null,
        quote: "Valid quote",
        topicName: "Topic",
      };

      expect(() => llmClaim.parse(nullValues)).toThrow(ZodError);
    });

    it("should reject malformed duplicates array", () => {
      const malformedDuplicates = {
        claim: "Valid claim",
        quote: "Valid quote",
        topicName: "Topic",
        duplicates: [
          {
            // Missing required fields in duplicate
            claim: "Duplicate without quote",
          },
        ],
      };

      expect(() => llmClaim.parse(malformedDuplicates)).toThrow(ZodError);
    });

    it("should reject duplicated as non-boolean", () => {
      const wrongDuplicatedType = {
        claim: "Valid claim",
        quote: "Valid quote",
        topicName: "Topic",
        duplicated: "yes", // should be boolean
      };

      expect(() => llmClaim.parse(wrongDuplicatedType)).toThrow(ZodError);
    });
  });

  describe("safeParse for graceful error handling", () => {
    it("should return success: false for invalid data without throwing", () => {
      const invalidData = { wrong: "shape" };

      const result = llmClaim.safeParse(invalidData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ZodError);
        expect(result.error.errors.length).toBeGreaterThan(0);
      }
    });

    it("should return success: true with parsed data for valid input", () => {
      const validData = {
        claim: "Valid claim",
        quote: "Valid quote",
        topicName: "Topic",
      };

      const result = llmClaim.safeParse(validData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.claim).toBe("Valid claim");
      }
    });
  });
});
