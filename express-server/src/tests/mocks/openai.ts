import { mockResponses } from './responses';

const wrapResponse = (content: any) => ({
  choices: [{
    message: {
      content: JSON.stringify(content)
    }
  }],
  usage: {
    total_tokens: 100,
    prompt_tokens: 50,
    completion_tokens: 50
  }
});

export const mockOpenAIResponse = {
  topic_tree: wrapResponse(mockResponses.topicTree),
  claims: wrapResponse(mockResponses.claims)
};

export const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn(async ({ messages }) => {
        const isTopicTree = messages[1].content.includes("topic tree");
        return isTopicTree ? mockOpenAIResponse.topic_tree : mockOpenAIResponse.claims;
      })
    }
  }
}; 