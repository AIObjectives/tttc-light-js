import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

import { Tracker, Cache } from "tttc-common/schema";

export const gpt = async (
  model: String,
  apiKey: string,
  cacheKey: string,
  system: string,
  user: string,
  tracker: Tracker,
  cache?: Cache,
) => {
  if (cache && cache.get(cacheKey)) return cache.get(cacheKey);
  const start = Date.now();

  let message: string;
  let finish_reason: string;
  let prompt_tokens: number;
  let completion_tokens: number;

  // OPENAI GPT
  if (model.startsWith("gpt")) {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      model: model as any,
      ...(model.startsWith("gpt-4-turbo")
        ? { response_format: { type: "json_object" } }
        : {}),
    });
    prompt_tokens = completion.usage!.prompt_tokens;
    completion_tokens = completion.usage!.completion_tokens;
    finish_reason = completion.choices[0].finish_reason;
    message = completion.choices[0].message.content!;
  }

  // ANTHROPIC CLAUDE
  else if (model.startsWith("claude")) {
    const anthropic = new Anthropic({ apiKey });
    const completion = await anthropic.messages.create({
      model: model as any,
      system,
      max_tokens: 4096,
      messages: [{ role: "user", content: user }],
    });
    prompt_tokens = completion.usage.input_tokens;
    completion_tokens = completion.usage.output_tokens;
    finish_reason = completion.stop_reason || "stop";
    message = completion.content[0].text;
  }

  // not supporting other models yet
  else {
    throw new Error(`Unknown model: ${model}`);
  }

  const cost =
    prompt_tokens * (10 / 1000000) + completion_tokens * (30 / 1000000);
  tracker.costs += cost;
  tracker.prompt_tokens += prompt_tokens;
  tracker.completion_tokens += completion_tokens;
  if (finish_reason !== "stop" && finish_reason !== "end_turn") {
    console.log(message);
    throw new Error("the AI stopped early!");
  } else {
    const result = JSON.parse(message);
    if (cache) cache.set(cacheKey, result);
    const _s = ((Date.now() - start) / 1000).toFixed(1);
    const _c = cost.toFixed(2);
    console.log(
      `[${cacheKey}] ${_s}s and ~$${_c} for ${prompt_tokens}+${completion_tokens} tokens`,
    );
    return result;
  }
};

export default gpt;
