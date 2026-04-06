/**
 * LLM client abstraction for pipeline steps
 *
 * Defines the LLMClient interface that all LLM providers must implement,
 * along with the OpenAI implementation. Adding a new provider (e.g. Anthropic)
 * means implementing LLMClient and providing a factory function.
 */

import OpenAI from "openai";
import { failure, type Result, success } from "tttc-common/functional-utils";
import { logger } from "tttc-common/logger";
import * as weave from "weave";
import {
  ApiCallFailedError,
  type ClusteringError,
  EmptyResponseError,
  type TokenUsage,
} from "./types.js";

const llmClientLogger = logger.child({ module: "llm-client" });

/**
 * The response returned by LLMClient.complete()
 */
export interface LLMResponse {
  content: string;
  usage: TokenUsage;
}

/**
 * Interface that all LLM provider clients must implement.
 * Pipeline steps call complete() without knowing which provider is underneath.
 */
export interface LLMClient {
  readonly modelName: string;
  complete(params: {
    systemPrompt: string;
    userPrompt: string;
  }): Promise<Result<LLMResponse, ClusteringError>>;
}

/**
 * OpenAI implementation of LLMClient using the Responses API.
 */
export class OpenAILLMClient implements LLMClient {
  constructor(
    readonly modelName: string,
    private readonly openaiClient: OpenAI,
  ) {}

  async complete(params: {
    systemPrompt: string;
    userPrompt: string;
  }): Promise<Result<LLMResponse, ClusteringError>> {
    const { systemPrompt, userPrompt } = params;

    let response: Awaited<
      ReturnType<typeof this.openaiClient.responses.create>
    >;
    try {
      response = await this.openaiClient.responses.create({
        model: this.modelName,
        instructions: systemPrompt,
        input: userPrompt,
        text: {
          format: {
            type: "json_object",
          },
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      llmClientLogger.error(
        { error, modelName: this.modelName },
        "Failed to call OpenAI API",
      );
      return failure(new ApiCallFailedError(this.modelName, errorMessage));
    }

    const usage: TokenUsage = {
      input_tokens: response.usage?.input_tokens ?? 0,
      output_tokens: response.usage?.output_tokens ?? 0,
      total_tokens: response.usage?.total_tokens ?? 0,
    };

    const content = response.output_text;
    if (!content) {
      llmClientLogger.error(
        { modelName: this.modelName },
        "Empty response from OpenAI API",
      );
      return failure(new EmptyResponseError(this.modelName));
    }

    return success({ content, usage });
  }
}

/**
 * Create an OpenAI LLM client, optionally initializing Weave tracing.
 *
 * @param apiKey - OpenAI API key
 * @param modelName - Model name (e.g., "gpt-4o-mini")
 * @param options - Optional Weave configuration
 */
export async function createOpenAILLMClient(
  apiKey: string,
  modelName: string,
  options: {
    enableWeave?: boolean;
    weaveProjectName?: string;
  } = {},
): Promise<OpenAILLMClient> {
  const openaiClient = new OpenAI({ apiKey });

  if (options.enableWeave && options.weaveProjectName) {
    try {
      await weave.init(options.weaveProjectName);
      llmClientLogger.info(
        { weaveProjectName: options.weaveProjectName },
        "Weave initialized successfully",
      );
    } catch (error) {
      llmClientLogger.error(
        { error, weaveProjectName: options.weaveProjectName },
        "Failed to initialize Weave",
      );
    }
  }

  return new OpenAILLMClient(modelName, openaiClient);
}
