import type { LLMClaim, Taxonomy } from "../../schema";

/**
 * Structure of LLM extraction model output
 * @property claims - Array of extracted claims with taxonomy mapping
 */
export type ExtractionModelOutput = {
  claims: LLMClaim[];
};

/**
 * Structure of a dataset row for extraction evaluation
 * @property comment - The user comment to extract claims from
 * @property taxonomy - The available taxonomy for mapping claims
 * @property expectedClaims - Optional array of expected claims for completeness checking
 */
export type ExtractionDatasetRow = {
  comment: string;
  taxonomy: Taxonomy;
  expectedClaims?: Array<LLMClaim>;
};

/**
 * Structure for scorer input
 * All extraction scorers must use this input format
 * @property modelOutput - The output from the extraction model
 * @property datasetRow - The original dataset row with input comment and taxonomy
 */
export type ExtractionScorerInput = {
  modelOutput: ExtractionModelOutput;
  datasetRow: ExtractionDatasetRow;
};

/**
 * Output of the JSON structure scorer
 * @property valid_json_structure - Boolean indicating if output matches expected schema
 * @property claims_count - The number of claims extracted
 * @property error - Error message if validation failed
 */
export type ExtractionJsonStructureScorerOutput = {
  valid_json_structure: boolean;
  claims_count?: number;
  error?: string;
};

/**
 * Output of the claim quality scorer
 * @property claim_quality_score - Score from 0-1 indicating quality of claims
 * @property quality_issues - Array of identified quality problems
 * @property issues_count - Number of quality issues found
 * @property claims_analyzed - Number of claims analyzed
 */
export type ClaimQualityScorerOutput = {
  claim_quality_score: number;
  quality_issues?: Array<string>;
  issues_count?: number;
  claims_analyzed?: number;
  error?: string;
};

/**
 * Output of the taxonomy alignment scorer
 * @property taxonomy_alignment_score - Score from 0-1 for taxonomy mapping correctness
 * @property valid_mappings - Number of claims with valid taxonomy mappings
 * @property invalid_mappings - Number of claims with invalid taxonomy mappings
 * @property total_claims - Total number of claims analyzed
 * @property invalid_mapping_details - Details about invalid mappings
 */
export type TaxonomyAlignmentScorerOutput = {
  taxonomy_alignment_score: number;
  valid_mappings?: number;
  invalid_mappings?: number;
  total_claims?: number;
  invalid_mapping_details?: Array<{
    claim: string;
    invalidTopic: string;
    invalidSubtopic?: string;
  }>;
  error?: string;
};

/**
 * Output of the quote relevance scorer
 * @property quote_relevance_score - Score from 0-1 for quote quality
 * @property relevant_quotes - Number of quotes that properly support claims
 * @property total_quotes - Total number of quotes analyzed
 * @property quote_issues - Details about problematic quotes
 */
export type QuoteRelevanceScorerOutput = {
  quote_relevance_score: number;
  relevant_quotes?: number;
  total_quotes?: number;
  quote_issues?: Array<{
    claim: string;
    quote: string;
    issues: Array<string>;
  }>;
  error?: string;
};

/**
 * Output of the extraction completeness scorer
 * @property extraction_completeness_score - Score from 0-1 for extraction completeness
 * @property matched_claims - Number of expected claims that were found
 * @property expected_claims - Number of claims expected to be extracted
 * @property extracted_claims - Number of claims actually extracted
 * @property claim_matches - Details about matched claims
 * @property expected_zero_claims - True if zero claims were expected
 * @property extracted_claims_count - Count when zero claims expected
 * @property error - Error message if evaluation failed
 */
export type ExtractionCompletenessScorerOutput = {
  extraction_completeness_score: number;
  matched_claims?: number;
  expected_claims?: number;
  extracted_claims?: number;
  claim_matches?: Array<{
    expected: string;
    matched: string;
    score: number;
  }>;
  expected_zero_claims?: boolean;
  extracted_claims_count?: number;
  error?: string;
};

/**
 * Output of the LLM judge scorer
 * @property llm_judge_score - Overall score from 0-1 as judged by the LLM
 * @property claim_quality_score - Score for how debatable and meaningful claims are
 * @property quote_accuracy_score - Score for how well quotes support claims
 * @property taxonomy_mapping_score - Score for correctness of taxonomy assignments
 * @property completeness_score - Score for whether all important claims were extracted
 * @property reasoning - Brief explanation of the scores
 * @property error - Error message if evaluation failed
 */
export type ExtractionLLMJudgeOutput = {
  llm_judge_score: number;
  claim_quality_score?: number;
  quote_accuracy_score?: number;
  taxonomy_mapping_score?: number;
  completeness_score?: number;
  reasoning?: string;
  error?: string;
};
