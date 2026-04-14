/**
 * Model definitions for supported LLM providers.
 *
 * This module defines the supported models for both OpenAI and Anthropic,
 * along with utility functions for determining model providers.
 */

export const SUPPORTED_OPENAI_MODELS = ["gpt-4o", "gpt-4o-mini"] as const;

export type SupportedOpenAIModel = (typeof SUPPORTED_OPENAI_MODELS)[number];

export const SUPPORTED_ANTHROPIC_MODELS = [
  "claude-opus-4-5",
  "claude-sonnet-4-5",
  "claude-haiku-4-5",
] as const;

export type SupportedAnthropicModel =
  (typeof SUPPORTED_ANTHROPIC_MODELS)[number];

export type SupportedModel = SupportedOpenAIModel | SupportedAnthropicModel;

export const SUPPORTED_MODELS: readonly SupportedModel[] = [
  ...SUPPORTED_OPENAI_MODELS,
  ...SUPPORTED_ANTHROPIC_MODELS,
] as const;

export const DEFAULT_MODEL: SupportedModel = "gpt-4o-mini";

export type ModelProvider = "openai" | "anthropic";

/**
 * Determine the provider for a given model name.
 *
 * @param modelName - The model identifier string
 * @returns "anthropic" if the model is an Anthropic model, "openai" otherwise
 *
 * @example
 * getModelProvider("claude-sonnet-4-5") // "anthropic"
 * getModelProvider("gpt-4o-mini")       // "openai"
 * getModelProvider("unknown-model")     // "openai"
 */
export function getModelProvider(modelName: string): ModelProvider {
  if ((SUPPORTED_ANTHROPIC_MODELS as readonly string[]).includes(modelName)) {
    return "anthropic";
  }
  return "openai";
}

/**
 * Check whether a model name refers to an Anthropic model.
 *
 * @param modelName - The model identifier string
 * @returns true if the model is an Anthropic model, false otherwise
 *
 * @example
 * isAnthropicModel("claude-opus-4-5")  // true
 * isAnthropicModel("gpt-4o-mini")      // false
 */
export function isAnthropicModel(modelName: string): boolean {
  return getModelProvider(modelName) === "anthropic";
}

/**
 * Type guard to check whether a string is a supported model identifier.
 *
 * @param modelName - The string to check
 * @returns true if the string is a supported model, with TypeScript narrowing
 *
 * @example
 * isSupportedModel("gpt-4o-mini")      // true
 * isSupportedModel("unknown-model")    // false
 */
export function isSupportedModel(
  modelName: string,
): modelName is SupportedModel {
  return (SUPPORTED_MODELS as readonly string[]).includes(modelName);
}
