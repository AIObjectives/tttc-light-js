/**
 * A participant claim with identifying information
 * @property claimId - Unique identifier for the claim
 * @property claimText - The text content of the claim
 * @property quoteText - The supporting quote for the claim
 */
export type Claim = {
  claimId: string;
  claimText: string;
  quoteText: string;
};

/**
 * A claim grouped together from several similar claims
 * @property claimText - The consolidated text representing the group
 * @property originalClaimIds - Array of original claim IDs that were grouped together
 */
export type GroupedClaim = {
  claimText: string;
  originalClaimIds: Array<string>;
};

/**
 * Structure of LLM deduplication model output
 * @property groupedClaims - Array of deduplicated and grouped claims
 */
export type DeduplicationModelOutput = {
  groupedClaims: Array<GroupedClaim>;
};

/**
 * Structure of a dataset row for deduplication evaluation
 * @property id - Unique identifier for the dataset row
 * @property claims - Formatted string containing all input claims
 */
export type DeduplicationDatasetRow = {
  id: string;
  claims: string;
};

/**
 * Structure for scorer input
 * All deduplication scorers must use this input format
 * @property modelOutput - The output from the deduplication model
 * @property datasetRow - The original dataset row with input claims
 */
export type DeduplicationScorerInput = {
  modelOutput: DeduplicationModelOutput;
  datasetRow: DeduplicationDatasetRow;
};

/**
 * Output of the JSON structure scorer
 * @property valid_json_structure - Boolean value on whether the output matches the expected JSON schema
 * @property groups_count - The number of claim groups returned
 * @property total_claims_referenced - The total number of claims referenced within claims
 * @property reason - Reason for a false structure
 * @property error - System error
 */
export type DeduplicationJsonStructureScorerOutput = {
  valid_json_structure: boolean;
  groups_count?: number;
  total_claims_referenced?: number;
  reason?: string;
  error?: string;
};

/**
 * Output scores for the claim coverage scorer
 * @property claim_coverage_score - Coverage score from 0-1, calculated as 1 - (# of missing claims + # of extra claims) / total # of claims
 * @property missing_claims - Array of IDs of claims that were left out of the consolidation
 * @property extra_claims - Array of IDs of claims that were in the consolidation but not in the original dataset
 * @property total_input_claims - Number of claims in the input dataset
 * @property total_referenced_claims - Number of claims referenced in a grouped claim
 * @property reason - Reason for a 0 coverage score
 */
export type ClaimCoverageScorerOutput = {
  claim_coverage_score: number;
  missing_claims?: Array<string>;
  extra_claims?: Array<string>;
  total_input_claims?: number;
  total_referenced_claims?: number;
  reason?: string;
};

/**
 * Output of consolidation scorer
 * @property consolidation_score - Score from 0-1 indicating consolidation effectiveness
 * @property consolidation_ratio - Ratio of output groups to input claims
 * @property input_claims_count - Number of claims in the input
 * @property output_groups_count - Number of groups in the output
 * @property single_claim_groups - Number of groups containing only one claim
 * @property consolidation_issues - Array of identified consolidation problems
 * @property avg_claims_per_group - Average number of claims per group
 * @property reason - Reason for a 0 score
 */
export type DeduplicationConsolidationScorerOutput = {
  consolidation_score: number;
  consolidation_ratio?: number;
  input_claims_count?: number;
  output_groups_count?: number;
  single_claim_groups?: number;
  consolidation_issues?: Array<string>;
  avg_claims_per_group?: number;
  reason?: string;
};

/**
 * Output of the group claim quality scorer
 * @property group_claim_quality_score - Score from 0-1 indicating quality of group claim texts
 * @property quality_issues - Array of identified quality problems
 * @property issues_count - Number of quality issues found
 * @property groups_analyzed - Number of groups analyzed
 * @property reason - Reason for a 0 group_claim_quality_score
 */
export type DeduplicationGroupClaimQualityScorerOutput = {
  group_claim_quality_score: number;
  quality_issues?: Array<string>;
  issues_count?: number;
  groups_analyzed?: number;
  reason?: string;
};

/**
 * Output scores of LLM judge
 * @property llm_judge_score - Overall score from 0-1 as judged by the LLM
 * @property grouping_accuracy_score - Score for how well similar claims are grouped
 * @property separation_quality_score - Score for keeping distinct claims separate
 * @property consolidated_claim_quality_score - Score for quality of consolidated claim texts
 * @property completeness_score - Score for whether all claims are properly referenced
 * @property reasoning - Brief explanation of the scores
 * @property error - Error message if evaluation failed
 */
export type DeduplicationLLMJudgeOutput = {
  llm_judge_score: number;
  grouping_accuracy_score?: number;
  separation_quality_score?: number;
  consolidated_claim_quality_score?: number;
  completeness_score?: number;
  reasoning?: string;
  error?: string;
};

/**
 * Function signature for LLM judge scorer
 */
export type LLMJudgeScorerFunction = (
  args: DeduplicationScorerInput,
) => Promise<DeduplicationLLMJudgeOutput>;
