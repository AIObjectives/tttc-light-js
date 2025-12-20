import type { OpenAI } from "openai";
import * as weave from "weave";
import { logger } from "../../logger";
import { EVAL_MODEL } from "../constants";
import type {
  ClaimQualityScorerOutput,
  ExtractionDatasetRow,
  ExtractionJsonStructureScorerOutput,
  ExtractionLLMJudgeOutput,
  ExtractionModelOutput,
  ExtractionScorerInput,
  QuoteRelevanceScorerOutput,
  TaxonomyAlignmentScorerOutput,
} from "./types";

const evaluationLogger = logger.child({ module: "evaluations" });

/**
 * Scorer for valid JSON structure of extraction output
 * Validates that the model output conforms to the expected schema with required fields
 * @param input - The scorer input containing model output
 * @returns Validation results with structure validity and counts
 */
export const extractionJsonStructureScorer = weave.op(
  function extractionJsonStructureScorer({
    modelOutput,
  }: ExtractionScorerInput): ExtractionJsonStructureScorerOutput {
    try {
      const hasValidStructure =
        modelOutput?.claims && Array.isArray(modelOutput.claims);

      if (!hasValidStructure) {
        return {
          valid_json_structure: false,
          error: "Missing or invalid claims array",
        };
      }

      // Check each claim has required fields
      for (const claim of modelOutput.claims) {
        if (
          !claim.claim ||
          !claim.quote ||
          !claim.topicName ||
          !claim.subtopicName
        ) {
          return {
            valid_json_structure: false,
            error: "Invalid claim structure - missing required fields",
          };
        }

        // Check that claim is not empty
        if (claim.claim.trim().length === 0) {
          return {
            valid_json_structure: false,
            error: "Empty claim text",
          };
        }

        // Check that quote is not empty
        if (claim.quote.trim().length === 0) {
          return {
            valid_json_structure: false,
            error: "Empty quote text",
          };
        }
      }

      return {
        valid_json_structure: true,
        claims_count: modelOutput.claims.length,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        return { valid_json_structure: false, error: error.message };
      } else {
        return { valid_json_structure: false, error: String(error) };
      }
    }
  },
);

/**
 * Scorer for claim quality (checks if claims are debatable, not platitudes)
 * Evaluates whether claims are meaningful, debatable positions
 * @param input - The scorer input containing model output
 * @returns Quality metrics and identified issues
 */
export const claimQualityScorer = weave.op(function claimQualityScorer({
  modelOutput,
}: ExtractionScorerInput): ClaimQualityScorerOutput {
  if (!modelOutput?.claims) {
    return { claim_quality_score: 0, error: "No claims found" };
  }

  const claims = modelOutput.claims;
  const qualityIssues = [];
  let qualityScore = 1;

  // Check for platitudes or truisms
  const platitudeTerms = [
    "important",
    "good",
    "bad",
    "nice",
    "great",
    "wonderful",
    "terrible",
    "communication is important",
    "we should",
    "people need",
    "it's good to",
  ];

  // Check for non-debatable statements
  const nonDebatablePatterns = [
    /^I (like|love|hate|enjoy|prefer)/i,
    /^(today|yesterday|last week)/i,
    /^(in my opinion|I think|I believe)/i,
  ];

  for (const claim of claims) {
    const claimText = claim.claim.toLowerCase();

    // Check for platitudes
    if (platitudeTerms.some((term) => claimText.includes(term.toLowerCase()))) {
      qualityIssues.push(`Potential platitude: ${claim.claim}`);
      qualityScore -= 0.2;
    }

    // Check for very short claims (likely not substantial)
    if (claim.claim.length < 10) {
      qualityIssues.push(`Claim too short: ${claim.claim}`);
      qualityScore -= 0.15;
    }

    // Check for very long claims (likely not concise)
    if (claim.claim.length > 200) {
      qualityIssues.push(`Claim too long: ${claim.claim.substring(0, 50)}...`);
      qualityScore -= 0.1;
    }

    // Check if claim seems to be just a personal preference without broader principle
    if (nonDebatablePatterns.some((pattern) => pattern.test(claim.claim))) {
      qualityIssues.push(`Non-debatable personal statement: ${claim.claim}`);
      qualityScore -= 0.25;
    }
  }

  return {
    claim_quality_score: Math.max(0, qualityScore),
    quality_issues: qualityIssues,
    issues_count: qualityIssues.length,
    claims_analyzed: claims.length,
  };
});

/**
 * Scorer for taxonomy alignment (checks if claims map to valid topics/subtopics)
 * Validates that claims are correctly mapped to existing taxonomy entries
 * @param input - The scorer input containing model output and dataset row
 * @returns Alignment metrics and invalid mapping details
 */
export const taxonomyAlignmentScorer = weave.op(
  function taxonomyAlignmentScorer({
    modelOutput,
    datasetRow,
  }: ExtractionScorerInput): TaxonomyAlignmentScorerOutput {
    if (!modelOutput?.claims) {
      return { taxonomy_alignment_score: 0, error: "No claims found" };
    }

    if (!datasetRow?.taxonomy) {
      return { taxonomy_alignment_score: 0, error: "No taxonomy provided" };
    }

    const claims = modelOutput.claims;
    const taxonomy = datasetRow.taxonomy;

    let validMappings = 0;
    const invalidMappings = [];

    for (const claim of claims) {
      let foundValidMapping = false;

      // Check if the topic and subtopic exist in the taxonomy
      for (const topic of taxonomy) {
        if (topic.topicName === claim.topicName) {
          for (const subtopic of topic.subtopics) {
            if (subtopic.subtopicName === claim.subtopicName) {
              foundValidMapping = true;
              break;
            }
          }
          break;
        }
      }

      if (foundValidMapping) {
        validMappings++;
      } else {
        invalidMappings.push({
          claim: claim.claim,
          invalidTopic: claim.topicName,
          invalidSubtopic: claim.subtopicName,
        });
      }
    }

    const alignmentScore =
      claims.length > 0 ? validMappings / claims.length : 1;

    return {
      taxonomy_alignment_score: alignmentScore,
      valid_mappings: validMappings,
      invalid_mappings: invalidMappings.length,
      total_claims: claims.length,
      invalid_mapping_details: invalidMappings,
    };
  },
);

/**
 * Scorer for quote relevance (checks if quotes support the claims)
 * Evaluates whether quotes properly support claims and match the original comment
 * @param input - The scorer input containing model output and dataset row
 * @returns Relevance metrics and quote issues
 */
export const quoteRelevanceScorer = weave.op(function quoteRelevanceScorer({
  modelOutput,
  datasetRow,
}: ExtractionScorerInput): QuoteRelevanceScorerOutput {
  if (!modelOutput?.claims) {
    return { quote_relevance_score: 0, error: "No claims found" };
  }

  const claims = modelOutput.claims;
  const originalComment = datasetRow?.comment || "";

  let relevantQuotes = 0;
  const quoteIssues = [];

  for (const claim of claims) {
    const issuesWithThisQuote = [];

    // Check if quote exists in original comment (allowing for [...] ellipsis)
    const cleanQuote = claim.quote.replace(/\[\.\.\.\]/g, "").trim();
    const quoteWords = cleanQuote
      .split(/\s+/)
      .filter((word: string) => word.length > 2);

    // Check if most quote words appear in the original comment
    const matchingWords = quoteWords.filter((word: string) =>
      originalComment.toLowerCase().includes(word.toLowerCase()),
    );

    const wordMatchRatio =
      quoteWords.length > 0 ? matchingWords.length / quoteWords.length : 0;

    if (wordMatchRatio < 0.7) {
      issuesWithThisQuote.push("Quote does not closely match original comment");
    }

    // Check if quote is too short (likely not supportive enough)
    if (claim.quote.length < 10) {
      issuesWithThisQuote.push("Quote too short to support claim");
    }

    // Check if quote is just a repetition of the claim
    const claimWords = claim.claim.toLowerCase().split(/\s+/);
    const quoteWords2 = claim.quote.toLowerCase().split(/\s+/);
    const overlap = claimWords.filter((word: string) =>
      quoteWords2.includes(word),
    ).length;
    const overlapRatio =
      claimWords.length > 0 ? overlap / claimWords.length : 0;

    if (overlapRatio > 0.8) {
      issuesWithThisQuote.push(
        "Quote is too similar to claim (likely circular)",
      );
    }

    if (issuesWithThisQuote.length === 0) {
      relevantQuotes++;
    } else {
      quoteIssues.push({
        claim: claim.claim,
        quote: claim.quote,
        issues: issuesWithThisQuote,
      });
    }
  }

  const relevanceScore = claims.length > 0 ? relevantQuotes / claims.length : 1;

  return {
    quote_relevance_score: relevanceScore,
    relevant_quotes: relevantQuotes,
    total_quotes: claims.length,
    quote_issues: quoteIssues,
  };
});

/**
 * Function signature for LLM judge scorer
 */
type LLMJudgeScorerFunction = (
  args: ExtractionScorerInput,
) => Promise<ExtractionLLMJudgeOutput>;

/**
 * Creates an LLM-as-a-judge scorer for evaluating extraction quality
 * Uses an LLM to evaluate claim quality, quote accuracy, taxonomy mapping, and completeness
 * @param openaiClient - The OpenAI client instance to use for LLM evaluation
 * @returns A weave operation that performs LLM-based evaluation
 */
export function createLLMJudgeScorer(
  openaiClient: OpenAI,
): weave.Op<LLMJudgeScorerFunction> {
  return weave.op(async function llmExtractionJudgeScorer({
    modelOutput,
    datasetRow,
  }: ExtractionScorerInput): Promise<ExtractionLLMJudgeOutput> {
    if (!modelOutput?.claims) {
      return {
        llm_judge_score: 0,
        error: "Missing claims data",
      };
    }

    const prompt = `You are evaluating the quality of an LLM in extracting debatable claims from a user comment and mapping them to a taxonomy.

Input Comment:
${datasetRow.comment}

Available Taxonomy:
${JSON.stringify(datasetRow.taxonomy, null, 2)}

Extracted Claims:
${JSON.stringify(modelOutput.claims, null, 2)}

Evaluate the quality of the extracted claims. Consider:
1. Claim Quality: Are the claims debatable, meaningful positions (not platitudes or personal preferences)?
2. Quote Accuracy: Do the quotes accurately support the claims and come from the original comment?
3. Taxonomy Mapping: Are claims correctly mapped to appropriate topics and subtopics?
4. Completeness: Were all important debatable claims extracted from the comment?

Provide your evaluation as a JSON object with:
- claim_quality_score: 0-1 score for how debatable and meaningful the claims are
- quote_accuracy_score: 0-1 score for how well quotes support claims and match the original comment
- taxonomy_mapping_score: 0-1 score for correctness of topic/subtopic assignments
- completeness_score: 0-1 score for whether all important claims were extracted
- overall_score: 0-1 overall quality score
- reasoning: brief explanation of the scores
`;

    try {
      const response = await openaiClient.chat.completions.create({
        model: EVAL_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are an expert evaluator of claim extraction quality. You understand what makes a claim debatable versus a platitude or personal preference.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0].message.content;
      if (!content) {
        return {
          llm_judge_score: 0,
          error: "No response from LLM judge",
        };
      }

      const evaluation = JSON.parse(content);
      evaluationLogger.debug({ evaluation }, "LLM judge evaluation result");

      return {
        llm_judge_score: evaluation.overall_score || 0,
        claim_quality_score: evaluation.claim_quality_score || 0,
        quote_accuracy_score: evaluation.quote_accuracy_score || 0,
        taxonomy_mapping_score: evaluation.taxonomy_mapping_score || 0,
        completeness_score: evaluation.completeness_score || 0,
        reasoning: evaluation.reasoning || "",
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        return {
          llm_judge_score: 0,
          error: error.message,
        };
      } else {
        return {
          llm_judge_score: 0,
          error: String(error),
        };
      }
    }
  });
}

/**
 * Function signature for extraction model
 */
type ExtractionModelFunction = (args: {
  datasetRow: ExtractionDatasetRow;
}) => Promise<ExtractionModelOutput>;

/**
 * Helper function to create an extraction model
 * Creates a weave operation that extracts claims from comments using an LLM
 * @param openaiClient - The OpenAI client instance
 * @param hydratePromptLiterals - Function to hydrate prompt templates
 * @param defaultExtractionPrompt - The prompt template for extraction
 * @param systemPrompt - The system prompt for the LLM
 * @returns A weave operation that performs claim extraction
 */
export function createExtractionModel(
  openaiClient: OpenAI,
  hydratePromptLiterals: (
    prompt: string,
    dataObj: Record<string, string>,
  ) => string,
  defaultExtractionPrompt: string,
  systemPrompt: string,
): weave.Op<ExtractionModelFunction> {
  return weave.op(async function extractionModel({
    datasetRow,
  }: {
    datasetRow: ExtractionDatasetRow;
  }): Promise<ExtractionModelOutput> {
    const hydratedPrompt = hydratePromptLiterals(defaultExtractionPrompt, {
      comment: datasetRow.comment,
      taxonomy: JSON.stringify(datasetRow.taxonomy, null, 2),
    });

    const response = await openaiClient.chat.completions.create({
      model: EVAL_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: hydratedPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const result = response.choices[0].message.content;
    if (result == null) {
      throw new Error("No response from model");
    }

    try {
      return JSON.parse(result);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Failed to parse JSON response: ${errorMsg}. Raw response: ${result}`,
      );
    }
  });
}
