/**
 * Tests for the LLM client abstraction layer
 */

import { describe, expect, it, vi } from "vitest";

// Mock the logger
vi.mock("tttc-common/logger", () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

// Mock OpenAI
vi.mock("openai", () => {
  const mockResponsesCreate = vi.fn();
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    responses: { create: mockResponsesCreate },
  }));
  return { default: MockOpenAI, __mockResponsesCreate: mockResponsesCreate };
});

// Mock Anthropic
vi.mock("@anthropic-ai/sdk", () => {
  const mockMessagesCreate = vi.fn();
  const MockAnthropic = vi.fn().mockImplementation(() => ({
    messages: { create: mockMessagesCreate },
  }));
  return { default: MockAnthropic, __mockMessagesCreate: mockMessagesCreate };
});

import {
  AnthropicLLMClient,
  createLLMClient,
  OpenAILLMClient,
} from "../llm-client.js";

describe("OpenAILLMClient", () => {
  const makeClient = () => {
    const mockResponsesCreate = vi.fn();
    const mockOpenAI = {
      responses: { create: mockResponsesCreate },
    };
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const client = new OpenAILLMClient(mockOpenAI as any);
    return { client, mockResponsesCreate };
  };

  it("should have provider = 'openai'", () => {
    const { client } = makeClient();
    expect(client.provider).toBe("openai");
  });

  it("should call responses.create with correct params for JSON mode", async () => {
    const { client, mockResponsesCreate } = makeClient();
    mockResponsesCreate.mockResolvedValueOnce({
      output_text: '{"result": "test"}',
      usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
    });

    const result = await client.call({
      model: "gpt-4o-mini",
      systemPrompt: "You are helpful",
      userPrompt: "Test prompt",
      jsonMode: true,
    });

    expect(mockResponsesCreate).toHaveBeenCalledWith({
      model: "gpt-4o-mini",
      instructions: "You are helpful",
      input: "Test prompt",
      text: { format: { type: "json_object" } },
    });
    expect(result.content).toBe('{"result": "test"}');
    expect(result.usage.input_tokens).toBe(100);
    expect(result.usage.output_tokens).toBe(50);
    expect(result.usage.total_tokens).toBe(150);
  });

  it("should call responses.create with text format when jsonMode is false", async () => {
    const { client, mockResponsesCreate } = makeClient();
    mockResponsesCreate.mockResolvedValueOnce({
      output_text: "Plain text response",
      usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
    });

    await client.call({
      model: "gpt-4o-mini",
      systemPrompt: "System",
      userPrompt: "User",
      jsonMode: false,
    });

    expect(mockResponsesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        text: { format: { type: "text" } },
      }),
    );
  });

  it("should throw when response has no content", async () => {
    const { client, mockResponsesCreate } = makeClient();
    mockResponsesCreate.mockResolvedValueOnce({
      output_text: "",
      usage: { input_tokens: 10, output_tokens: 0, total_tokens: 10 },
    });

    await expect(
      client.call({
        model: "gpt-4o-mini",
        systemPrompt: "System",
        userPrompt: "User",
        jsonMode: true,
      }),
    ).rejects.toThrow("OpenAI returned empty response");
  });

  it("should handle null usage by defaulting to 0", async () => {
    const { client, mockResponsesCreate } = makeClient();
    mockResponsesCreate.mockResolvedValueOnce({
      output_text: "response",
      usage: null,
    });

    const result = await client.call({
      model: "gpt-4o-mini",
      systemPrompt: "System",
      userPrompt: "User",
      jsonMode: false,
    });

    expect(result.usage.input_tokens).toBe(0);
    expect(result.usage.output_tokens).toBe(0);
    expect(result.usage.total_tokens).toBe(0);
  });
});

describe("AnthropicLLMClient", () => {
  const makeClient = () => {
    const mockMessagesCreate = vi.fn();
    const mockAnthropic = {
      messages: { create: mockMessagesCreate },
    };
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const client = new AnthropicLLMClient(mockAnthropic as any);
    return { client, mockMessagesCreate };
  };

  it("should have provider = 'anthropic'", () => {
    const { client } = makeClient();
    expect(client.provider).toBe("anthropic");
  });

  it("should call messages.create with correct params for JSON mode", async () => {
    const { client, mockMessagesCreate } = makeClient();
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: '{"result": "test"}' }],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const result = await client.call({
      model: "claude-sonnet-4-5",
      systemPrompt: "You are helpful",
      userPrompt: "Test prompt",
      jsonMode: true,
    });

    expect(mockMessagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-4-5",
        system: expect.stringContaining("valid JSON only"),
        messages: [{ role: "user", content: "Test prompt" }],
        max_tokens: 8192,
      }),
    );
    expect(result.content).toBe('{"result": "test"}');
    expect(result.usage.input_tokens).toBe(100);
    expect(result.usage.output_tokens).toBe(50);
    expect(result.usage.total_tokens).toBe(150);
  });

  it("should not add JSON instruction when jsonMode is false", async () => {
    const { client, mockMessagesCreate } = makeClient();
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "Plain response" }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    await client.call({
      model: "claude-sonnet-4-5",
      systemPrompt: "You are helpful",
      userPrompt: "Test",
      jsonMode: false,
    });

    expect(mockMessagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        system: "You are helpful",
      }),
    );
  });

  it("should compute total_tokens as input + output", async () => {
    const { client, mockMessagesCreate } = makeClient();
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "response" }],
      usage: { input_tokens: 300, output_tokens: 200 },
    });

    const result = await client.call({
      model: "claude-sonnet-4-5",
      systemPrompt: "System",
      userPrompt: "User",
      jsonMode: false,
    });

    expect(result.usage.total_tokens).toBe(500);
  });

  it("should throw when response has no content blocks", async () => {
    const { client, mockMessagesCreate } = makeClient();
    mockMessagesCreate.mockResolvedValueOnce({
      content: [],
      usage: { input_tokens: 10, output_tokens: 0 },
    });

    await expect(
      client.call({
        model: "claude-sonnet-4-5",
        systemPrompt: "System",
        userPrompt: "User",
        jsonMode: true,
      }),
    ).rejects.toThrow("Anthropic returned no text content");
  });

  it("should throw when first content block is not text", async () => {
    const { client, mockMessagesCreate } = makeClient();
    mockMessagesCreate.mockResolvedValueOnce({
      content: [
        { type: "tool_use", id: "tool_1", name: "get_weather", input: {} },
      ],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    await expect(
      client.call({
        model: "claude-sonnet-4-5",
        systemPrompt: "System",
        userPrompt: "User",
        jsonMode: false,
      }),
    ).rejects.toThrow("Anthropic returned no text content");
  });
});

describe("createLLMClient", () => {
  it("should create an OpenAILLMClient for gpt-4o-mini", () => {
    const client = createLLMClient("gpt-4o-mini", "openai-key", undefined);
    expect(client.provider).toBe("openai");
    expect(client).toBeInstanceOf(OpenAILLMClient);
  });

  it("should create an OpenAILLMClient for gpt-4o", () => {
    const client = createLLMClient("gpt-4o", "openai-key", undefined);
    expect(client.provider).toBe("openai");
    expect(client).toBeInstanceOf(OpenAILLMClient);
  });

  it("should create an AnthropicLLMClient for claude-sonnet-4-5", () => {
    const client = createLLMClient(
      "claude-sonnet-4-5",
      undefined,
      "anthropic-key",
    );
    expect(client.provider).toBe("anthropic");
    expect(client).toBeInstanceOf(AnthropicLLMClient);
  });

  it("should create an AnthropicLLMClient for claude-opus-4-5", () => {
    const client = createLLMClient(
      "claude-opus-4-5",
      undefined,
      "anthropic-key",
    );
    expect(client.provider).toBe("anthropic");
    expect(client).toBeInstanceOf(AnthropicLLMClient);
  });

  it("should create an AnthropicLLMClient for claude-haiku-4-5", () => {
    const client = createLLMClient(
      "claude-haiku-4-5",
      undefined,
      "anthropic-key",
    );
    expect(client.provider).toBe("anthropic");
    expect(client).toBeInstanceOf(AnthropicLLMClient);
  });

  it("should throw when Anthropic key is missing for Claude model", () => {
    expect(() =>
      createLLMClient("claude-sonnet-4-5", "openai-key", undefined),
    ).toThrow("LLM configuration error");
  });

  it("should throw when OpenAI key is missing for OpenAI model", () => {
    expect(() =>
      createLLMClient("gpt-4o-mini", undefined, "anthropic-key"),
    ).toThrow("LLM configuration error");
  });

  it("should use the canonical allowlist (not prefix heuristic) to route models", () => {
    // gpt-4o is in SUPPORTED_OPENAI_MODELS, so it routes to OpenAI
    const client = createLLMClient("gpt-4o", "openai-key", "anthropic-key");
    expect(client.provider).toBe("openai");
  });

  it("should use OpenAI for unknown models (getModelProvider defaults to openai)", () => {
    // Unknown models fall through to OpenAI per getModelProvider contract
    const client = createLLMClient(
      "unknown-model",
      "openai-key",
      "anthropic-key",
    );
    expect(client.provider).toBe("openai");
  });
});
