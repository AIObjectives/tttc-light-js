import type { TopicSummary, SortedTopic } from "../../apiPyserver";

/**
 * Structure of a dataset row for summaries evaluation
 * @property id - Unique identifier for the dataset row
 * @property topics - A SortedTopic tuple [topicName, { counts, topics: [[subtopicName, { counts, claims }]] }]
 */
export type SummariesDatasetRow = {
  id: string;
  topic: SortedTopic;
};

/**
 * Structure of the summaries model output
 * @property summary - The generated summary text
 */
export type SummariesModelOutput = TopicSummary;

/**
 * Structure for scorer input
 * All summaries scorers must use this input format
 * @property modelOutput - The output from the summaries model
 * @property datasetRow - The original dataset row with input topics
 */
export type SummariesScorerInput = {
  modelOutput: SummariesModelOutput;
  datasetRow: SummariesDatasetRow;
};

/**
 * Output of the JSON structure scorer
 * @property valid_json_structure - Boolean indicating if output matches expected schema
 * @property summaries_count - The number of summaries generated
 * @property reason - Reason that json validation failed
 */
export type SummariesJsonStructureScorerOutput = {
  valid_json_structure: boolean;
  summaries_count?: number;
  reason?: string;
};

/**
 * Output of the summary length scorer
 * @property summary_length_score - Score from 0-1 for length compliance
 * @property summaries_within_limit - Number of summaries within 140 word limit
 * @property total_summaries - Total number of summaries analyzed
 * @property issues_count - Number of summaries exceeding length limit
 * @property issues - Details about length violations
 * @property error - Error message if evaluation failed
 */
export type SummaryLengthScorerOutput = {
  summary_length_score: number;
  summaries_within_limit?: number;
  total_summaries?: number;
  issues_count?: number;
  issues?: Array<string>;
  error?: string;
};

/**
 * Output of the summary content quality scorer
 * @property content_quality_score - Score from 0-1 for content quality
 * @property issues_count - Number of quality issues found
 * @property issues - Details about quality issues
 * @property error - Error message if evaluation failed
 */
export type SummaryContentQualityScorerOutput = {
  content_quality_score: number;
  issues_count?: number;
  issues?: Array<string>;
  error?: string;
};

/**
 * Output of the summaries topic coverage scorer
 * @property topic_coverage_score - Score from 0-1 for topic coverage
 * @property topics_matched - Number of input topics that have summaries
 * @property expected_topics - Number of topics in the input
 * @property generated_summaries - Number of summaries generated
 * @property error - Error message if evaluation failed
 */
export type SummariesTopicCoverageScorerOutput = {
  topic_coverage_score: number;
  topics_matched?: number;
  expected_topics?: number;
  generated_summaries?: number;
  error?: string;
};

/**
 * Output of the LLM judge scorer
 * @property llm_judge_score - Overall score from 0-1 as judged by the LLM
 * @property comprehensiveness_score - Score for how well all content is covered
 * @property synthesis_quality_score - Score for narrative quality and coherence
 * @property accuracy_score - Score for accuracy of claim representation
 * @property conciseness_score - Score for being concise while comprehensive
 * @property reasoning - Brief explanation of the scores
 * @property error - Error message if evaluation failed
 */
export type SummariesLLMJudgeOutput = {
  llm_judge_score: number;
  comprehensiveness_score?: number;
  synthesis_quality_score?: number;
  accuracy_score?: number;
  conciseness_score?: number;
  reasoning?: string;
  error?: string;
};
