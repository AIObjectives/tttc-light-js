import OpenAI from 'openai';
import type { TopicTreeTest, ClaimTest } from 'tttc-common/testCases';

interface PipelineResponse<T> {
  status: number;
  data: T;
}

const createClient = (apiKey: string) => new OpenAI({ apiKey });

const generateTopicTree = async (input: TopicTreeTest['input']): Promise<PipelineResponse<TopicTreeTest['expected']['taxonomy']>> => {
  const openai = createClient(input.llm.api_key);
  
  const response = await openai.chat.completions.create({
    model: input.llm.model_name,
    messages: [
      {
        role: "system",
        content: input.llm.system_prompt
      },
      {
        role: "user",
        content: input.llm.user_prompt + "\n" + JSON.stringify(input.comments)
      }
    ],
    temperature: 0.0,
    response_format: { type: "json_object" }
  });

  const result = JSON.parse(response.choices[0].message.content);
  return {
    status: 200,
    data: result.taxonomy
  };
};

const extractClaims = async (input: ClaimTest['input']): Promise<PipelineResponse<ClaimTest['expected']>> => {
  const openai = createClient(input.llm.api_key);
  
  const response = await openai.chat.completions.create({
    model: input.llm.model_name,
    messages: [
      {
        role: "system",
        content: input.llm.system_prompt
      },
      {
        role: "user",
        content: input.llm.user_prompt + "\n" + JSON.stringify({
          comments: input.comments,
          tree: input.tree
        })
      }
    ],
    temperature: 0.0,
    response_format: { type: "json_object" }
  });

  const result = JSON.parse(response.choices[0].message.content);
  return {
    status: 200,
    data: result
  };
};

const sortClaimsTree = async (input: {
  llm: ClaimTest['input']['llm'];
  tree: ClaimTest['expected'];
  sort: string;
}): Promise<PipelineResponse<any>> => {
  const openai = createClient(input.llm.api_key);
  
  const response = await openai.chat.completions.create({
    model: input.llm.model_name,
    messages: [
      {
        role: "system",
        content: input.llm.system_prompt
      },
      {
        role: "user",
        content: input.llm.user_prompt + "\n" + JSON.stringify({
          tree: input.tree,
          sort: input.sort
        })
      }
    ],
    temperature: 0.0,
    response_format: { type: "json_object" }
  });

  const result = JSON.parse(response.choices[0].message.content);
  return {
    status: 200,
    data: result
  };
};

export const pipeline = {
  generateTopicTree,
  extractClaims,
  sortClaimsTree
}; 