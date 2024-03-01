import OpenAI from "openai";
const openai = new OpenAI();

import { Tracker, Cache } from "./types";

export const gpt = async (
  key: string,
  system: string,
  user: string,
  tracker: Tracker,
  cache?: Cache
) => {
  if (cache && cache.get(key)) return cache.get(key);
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
  const { finish_reason, message } = completion.choices[0];
  if (finish_reason !== "stop") {
    console.log(completion);
    console.log(message);
    throw new Error("gpt 4 turbo stopped early!");
  } else {
    const result = JSON.parse(message.content!);
    if (cache) cache.set(key, result);
    const _s = ((Date.now() - start) / 1000).toFixed(1);
    const _c = cost.toFixed(2);
    console.log(
      `[${key}] ${_s}s and ~$${_c} for ${prompt_tokens}+${completion_tokens} tokens`
    );
    return result;
  }
};

export default gpt;
