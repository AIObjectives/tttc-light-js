import OpenAI from "openai";

import { Tracker, Cache } from "./types";

export const testGPT = async (apiKey: string) => {
  const openai = new OpenAI({ apiKey });
  await openai.chat.completions.create({
    messages: [{ role: "user", content: "hi" }],
    model: "gpt-4-turbo-preview",
  });
};

export const gpt = async (
  apiKey: string,
  cacheKey: string,
  system: string,
  user: string,
  tracker: Tracker,
  cache?: Cache
) => {
  const openai = new OpenAI({ apiKey });
  if (cache && cache.get(cacheKey)) return cache.get(cacheKey);
  const start = Date.now();
  const completion = await openai.chat.completions.create({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    model: "gpt-4-turbo-preview",
    response_format: { type: "json_object" },
  });
  const { prompt_tokens, completion_tokens } = completion.usage!;
  const cost =
    prompt_tokens * (10 / 1000000) + completion_tokens * (30 / 1000000);
  tracker.costs += cost;
  tracker.prompt_tokens += prompt_tokens;
  tracker.completion_tokens += completion_tokens;
  const { finish_reason, message } = completion.choices[0];
  if (finish_reason !== "stop") {
    console.log(completion);
    console.log(message);
    throw new Error("gpt 4 turbo stopped early!");
  } else {
    const result = JSON.parse(message.content!);
    if (cache) cache.set(cacheKey, result);
    const _s = ((Date.now() - start) / 1000).toFixed(1);
    const _c = cost.toFixed(2);
    console.log(
      `[${cacheKey}] ${_s}s and ~$${_c} for ${prompt_tokens}+${completion_tokens} tokens`
    );
    return result;
  }
};

export default gpt;
