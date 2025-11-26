import * as weave from "weave";
import type { OpenAI } from "openai";
import { hydratePromptLiterals } from "../prompts";

/**
 * Type signature for an evaluation model function that processes dataset rows
 *
 * @template DatasetRow - The structure of a single row from the evaluation dataset
 * @template ModelOutput - The expected structure of the model's output
 *
 * @param args - Function arguments
 * @param args.datasetRow - A single row from the evaluation dataset to process
 * @returns A promise that resolves to the model's structured output
 *
 * @example
 * ```typescript
 * type MyDatasetRow = { id: string; input: string };
 * type MyOutput = { result: string };
 *
 * const myFunction: EvaluationFunction<MyDatasetRow, MyOutput> =
 *   async ({ datasetRow }) => {
 *     return { result: datasetRow.input.toUpperCase() };
 *   };
 * ```
 */
type EvaluationFunction<DatasetRow, ModelOutput> = (args: {
  datasetRow: DatasetRow;
}) => Promise<ModelOutput>;

/**
 * Creates a generic evaluation model function wrapped as a Weave operation
 *
 * This factory function creates a standardized LLM-based evaluation model that:
 * - Hydrates prompt templates with dataset row data
 * - Calls OpenAI's chat completion API with JSON response format
 * - Parses and returns structured JSON output
 * - Is tracked by Weave for observability and evaluation
 *
 * @template DatasetRow - The type of dataset rows the model will process. Should match the structure
 *                        of rows in your evaluation dataset.
 * @template ModelOutput - The expected output type from the model. Must be a JSON-serializable object.
 *
 * @param openaiClient - An OpenAI client instance*
 * @param openaiModel - An OpenAI model to use e.g. gpt-4o-mini
 * @param userPrompt - The user prompt template string. Can contain template variables like `${variableName}`
 *                     that will be hydrated with properties from the dataset row. Must include the word
 *                     "json" or "JSON" to work with response_format: json_object.
 * @param systemPrompt - The system prompt that sets the context and behavior for the LLM. Should instruct
 *                       the model to return JSON in the expected ModelOutput format.
 *
 * @returns A Weave operation that can be used as a model in evaluations. The operation takes a dataset
 *          row and returns the parsed JSON output from the LLM.
 *
 * @throws {Error} If the OpenAI API returns no content
 * @throws {Error} If the response cannot be parsed as valid JSON
 *
 * @example
 * ```typescript
 * import { OpenAI } from "openai";
 * import * as weave from "weave";
 *
 * type ExtractionRow = { comment: string; taxonomy: Taxonomy };
 * type ExtractionOutput = { claims: LLMClaim[] };
 *
 * const openaiClient = new OpenAI();
 *
 * const extractionModel = createEvaluationModel<ExtractionRow, ExtractionOutput>(
 *   openaiClient,
 *   "Extract claims from this comment: ${comment}. Use this taxonomy: ${taxonomy}",
 *   "You are a claim extraction expert. Return JSON with a 'claims' array."
 * );
 *
 * // Use in evaluation
 * const evaluation = new weave.Evaluation({
 *   dataset: myDataset,
 *   scorers: [scorer1, scorer2],
 * });
 *
 * await evaluation.evaluate({ model: extractionModel });
 * ```
 *
 * @see {@link hydratePromptLiterals} for details on prompt template hydration
 */

export function createEvaluationModel<DatasetRow, ModelOutput>(
  openaiClient: OpenAI,
  openaiModel: string,
  userPrompt: string,
  systemPrompt: string,
): weave.Op<EvaluationFunction<DatasetRow, ModelOutput>> {
  return weave.op(async function evaluationModel({
    datasetRow,
  }: {
    datasetRow: DatasetRow;
  }): Promise<ModelOutput> {
    // Hydrate the prompt template with dataset row properties
    const hydratedPrompt = hydratePromptLiterals(userPrompt, datasetRow);

    // Call OpenAI API with structured JSON output format
    const response = await openaiClient.chat.completions.create({
      model: openaiModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: hydratedPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const result = response.choices[0].message.content;
    if (!result) {
      throw new Error("No response from model");
    }

    // Parse and return the JSON response
    try {
      return JSON.parse(result);
    } catch (error) {
      throw new Error(`Failed to parse JSON response: ${result}: ${error}`);
    }
  });
}
