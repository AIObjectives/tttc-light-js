/**
 * LLM provider abstraction for pipeline steps.
 *
 * Provides a unified interface for calling OpenAI and Anthropic language models,
 * allowing pipeline steps to remain provider-agnostic.
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { logger } from "tttc-common/logger";
import { getModelProvider } from "tttc-common/schema";

const llmClientLogger = logger.child({ module: "llm-client" });

/**
 * Parameters for calling an LLM
 */
export interface LLMCallParams {
  /** Model identifier */
  model: string;
  /** System-level instructions */
  systemPrompt: string;
  /** User-level prompt */
  userPrompt: string;
  /** Whether to request JSON output */
  jsonMode: boolean;
}

/**
 * Standardized token usage from an LLM call
 */
export interface LLMUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

/**
 * Result of an LLM call
 */
export interface LLMCallResult {
  /** The text content returned by the model */
  content: string;
  /** Token usage for cost calculation */
  usage: LLMUsage;
}

/**
 * Unified interface for calling LLMs from different providers
 */
export interface LLMClient {
  /** The provider this client uses */
  provider: "openai" | "anthropic";
  /**
   * Call the LLM with a prompt and return the response.
   *
   * @param params - The call parameters
   * @returns The LLM response text and token usage
   */
  call(params: LLMCallParams): Promise<LLMCallResult>;
}

/**
 * OpenAI LLM client wrapping the Responses API.
 *
 * Uses the `openai.responses.create` endpoint with JSON mode support.
 */
export class OpenAILLMClient implements LLMClient {
  readonly provider = "openai" as const;

  constructor(private readonly client: OpenAI) {}

  /**
   * Call OpenAI via the Responses API.
   *
   * @param params - Call parameters including model, prompts, and JSON mode flag
   * @returns The text response and token usage
   * @throws If the API call fails or returns no content
   */
  async call(params: LLMCallParams): Promise<LLMCallResult> {
    const { model, systemPrompt, userPrompt, jsonMode } = params;

    const response = await this.client.responses.create({
      model,
      instructions: systemPrompt,
      input: userPrompt,
      text: {
        format: {
          type: jsonMode ? "json_object" : "text",
        },
      },
    });

    const content = response.output_text;
    if (!content) {
      throw new Error(`OpenAI returned empty response for model ${model}`);
    }

    const usage: LLMUsage = {
      input_tokens: response.usage?.input_tokens ?? 0,
      output_tokens: response.usage?.output_tokens ?? 0,
      total_tokens: response.usage?.total_tokens ?? 0,
    };

    return { content, usage };
  }
}

/**
 * Strip markdown code fences from a string.
 * Claude sometimes wraps JSON in ```json ... ``` despite being instructed not to.
 */
function stripMarkdownCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

/**
 * Anthropic LLM client wrapping the Messages API.
 *
 * Uses `anthropic.messages.create` with a fixed max_tokens of 8192.
 * JSON mode is achieved via system prompt instruction rather than a
 * dedicated API parameter (Anthropic does not have a native JSON mode).
 */
export class AnthropicLLMClient implements LLMClient {
  readonly provider = "anthropic" as const;

  constructor(private readonly client: Anthropic) {}

  /**
   * Call Anthropic via the Messages API.
   *
   * @param params - Call parameters including model, prompts, and JSON mode flag
   * @returns The text response and token usage (total = input + output)
   * @throws If the API call fails, returns no content, or the first block is not text
   */
  async call(params: LLMCallParams): Promise<LLMCallResult> {
    const { model, systemPrompt, userPrompt, jsonMode } = params;

    const effectiveSystem = jsonMode
      ? `${systemPrompt}\n\nYou must respond with valid JSON only. Do not include any text outside the JSON object.`
      : systemPrompt;

    const response = await this.client.messages.create({
      model,
      system: effectiveSystem,
      messages: [{ role: "user", content: userPrompt }],
      max_tokens: 8192,
    });

    const firstBlock = response.content[0];
    if (!firstBlock || firstBlock.type !== "text") {
      throw new Error(`Anthropic returned no text content for model ${model}`);
    }

    const content = jsonMode
      ? stripMarkdownCodeFences(firstBlock.text)
      : firstBlock.text;

    const input_tokens = response.usage.input_tokens;
    const output_tokens = response.usage.output_tokens;
    const usage: LLMUsage = {
      input_tokens,
      output_tokens,
      total_tokens: input_tokens + output_tokens,
    };

    return { content, usage };
  }
}

/**
 * Create the appropriate LLM client for a given model name.
 *
 * Routes to the correct provider using the canonical getModelProvider function
 * from tttc-common/schema, which checks the authoritative SUPPORTED_ANTHROPIC_MODELS
 * allowlist. This ensures provider routing stays in sync with the server's model
 * allowlist and avoids a divergent prefix-matching heuristic.
 *
 * @param modelName - The model identifier (e.g. "gpt-4o-mini" or "claude-sonnet-4-5")
 * @param openaiApiKey - OpenAI API key (required for OpenAI models)
 * @param anthropicApiKey - Anthropic API key (required for Anthropic models)
 * @returns An LLMClient instance configured for the specified model
 * @throws {Error} If the required API key for the model's provider is missing
 *
 * @example
 * const client = createLLMClient("gpt-4o-mini", process.env.OPENAI_API_KEY, undefined);
 * const result = await client.call({ model: "gpt-4o-mini", systemPrompt: "...", userPrompt: "...", jsonMode: true });
 */
export function createLLMClient(
  modelName: string,
  openaiApiKey: string | undefined,
  anthropicApiKey: string | undefined,
): LLMClient {
  const provider = getModelProvider(modelName);

  if (provider === "anthropic") {
    if (!anthropicApiKey) {
      throw new Error(`LLM configuration error`);
    }
    llmClientLogger.info(
      { modelName, provider: "anthropic" },
      "Creating Anthropic LLM client",
    );
    return new AnthropicLLMClient(new Anthropic({ apiKey: anthropicApiKey }));
  }

  if (!openaiApiKey) {
    throw new Error(`LLM configuration error`);
  }
  llmClientLogger.info(
    { modelName, provider: "openai" },
    "Creating OpenAI LLM client",
  );
  return new OpenAILLMClient(new OpenAI({ apiKey: openaiApiKey }));
}
