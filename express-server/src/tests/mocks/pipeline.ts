import { mockOpenAI, mockOpenAIResponse } from './openai';
import type { TopicTreeTest, ClaimTest } from 'tttc-common/testCases';

const createMockResponse = (status: number, data: any) => ({
  status,
  data
});

const callOpenAI = async (input: { llm: any, [key: string]: any }, content: any) => {
  await mockOpenAI.chat.completions.create({
    model: input.llm.model_name,
    messages: [
      {
        role: "system",
        content: input.llm.system_prompt
      },
      {
        role: "user",
        content: input.llm.user_prompt + "\n" + JSON.stringify(content)
      }
    ]
  });
};

export const mockPipeline = {
  generateTopicTree: vi.fn(async (input: TopicTreeTest['input']) => {
    await callOpenAI(input, input.comments);
    return createMockResponse(
      200, 
      JSON.parse(mockOpenAIResponse.topic_tree.choices[0].message.content).taxonomy
    );
  }),

  extractClaims: vi.fn(async (input: ClaimTest['input']) => {
    await callOpenAI(input, {
      comments: input.comments,
      tree: input.tree
    });
    return createMockResponse(
      200,
      JSON.parse(mockOpenAIResponse.claims.choices[0].message.content)
    );
  }),

  sortClaimsTree: vi.fn(async (input) => {
    return createMockResponse(200, input.tree);
  })
}; 