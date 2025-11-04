/**
 * Output from the Crux LLM call
 * @property crux - The crux analysis containing claim, participant assignments, and explanation
 * @property crux.cruxClaim - The central claim that represents the point of disagreement
 * @property crux.agree - Array of participant names who agree with the crux claim
 * @property crux.disagree - Array of participant names who disagree with the crux claim
 * @property crux.explanation - Explanation of why participants agree or disagree
 */
export type CruxModelOutput = {
  crux: {
    cruxClaim: string;
    agree: string[];
    disagree: string[];
    explanation: string;
  };
};

/**
 * Row of data input to evaluate against
 * @property topic - The main topic of discussion
 * @property topicDescription - Description of the main topic
 * @property subtopic - The specific subtopic being discussed
 * @property subtopicDescription - Description of the subtopic
 * @property participantClaims - Array of participants and their claims
 */
export type CruxDatasetRow = {
  topic: string;
  topicDescription: string;
  subtopic: string;
  subtopicDescription: string;
  participantClaims: Array<{ participant: string; claims: string[] }>;
};

/**
 * Input for all Crux scorers
 * All crux scorers must use this input format
 * @property modelOutput - The output from the crux model
 * @property datasetRow - The original dataset row with input data
 */
export type CruxScorerInput = {
  modelOutput: CruxModelOutput;
  datasetRow: CruxDatasetRow;
};

/**
 * Output of crux JSON structure scorer
 * @property valid_json_structure - Whether the output matches the expected JSON schema
 * @property agree_count - Number of participants who agree
 * @property disagree_count - Number of participants who disagree
 * @property total_participants - Total number of participants assigned
 * @property reason - Reason valid_json_structure returned false
 * @property error - System error message
 */
export type CruxJsonScorerOutput = {
  valid_json_structure: boolean;
  agree_count?: number;
  disagree_count?: number;
  total_participants?: number;
  reason?: string;
  error?: string;
};

/**
 * Output of the explanation quality scorer
 * @property explanation_quality_score - Score from 0-1 for explanation quality
 * @property quality_issues - Array of identified quality problems
 * @property issues_count - Number of quality issues found
 * @property explanation_length - Length of the explanation in characters
 * @property participants_referenced - Number of participants referenced in explanation
 * @property total_participants - Total number of participants
 * @property error - Error message if evaluation failed
 */
export type ExplanationQualityScorerOutput = {
  explanation_quality_score: number;
  quality_issues?: Array<string>;
  issues_count?: number;
  explanation_length?: number;
  participants_referenced?: number;
  total_participants?: number;
  error?: string;
};

/**
 * Output of the LLM judge scorer
 * @property llm_judge_score - Overall score from 0-1 as judged by the LLM
 * @property crux_quality_score - Score for how well the crux captures the disagreement
 * @property assignment_accuracy_score - Score for correctness of participant assignments
 * @property explanation_quality_score - Score for clarity and completeness of explanation
 * @property completeness_score - Score for how comprehensively it covers participants and disagreement
 * @property reasoning - Brief explanation of the scores
 * @property error - Error message if evaluation failed
 */
export type LLMJudgeOutput = {
  llm_judge_score: number;
  crux_quality_score?: number;
  assignment_accuracy_score?: number;
  explanation_quality_score?: number;
  completeness_score?: number;
  reasoning?: string;
  error?: string;
};

/**
 * Function signature for LLM judge scorer
 */
export type LLMJudgeFunction = (
  args: CruxScorerInput,
) => Promise<LLMJudgeOutput>;
