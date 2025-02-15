import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { TestCases } from 'tttc-common/testCases';
import { mockOpenAI } from './mocks/openai';
import { mockPipeline } from './mocks/pipeline';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Mock the pipeline module
vi.mock('../pipeline', () => ({
  pipeline: mockPipeline
}));

const loadTestCases = (): TestCases => {
  const testCasesPath = path.join(__dirname, '../../../common/test_cases.json');
  try {
    return JSON.parse(fs.readFileSync(testCasesPath, 'utf-8'));
  } catch (error) {
    console.error(`Failed to load test cases from ${testCasesPath}:`, error);
    return {
      sample_inputs: { min_pets_1: [], min_pets_3: [], dupes_pets_5: [] },
      topic_tree_tests: [],
      claim_tests: []
    };
  }
};

describe('Pipeline Tests', () => {
  const testCases = loadTestCases();
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Topic Tree Generation', () => {
    testCases.topic_tree_tests.forEach(({ name, input, expected }) => {
      it(`should generate correct topic tree: ${name}`, async () => {
        const response = await mockPipeline.generateTopicTree(input);
        
        expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
        expect(response.status).toBe(200);
        expect(response.data).toEqual(expected.taxonomy);
      });
    });
  });

  describe('Claims Extraction', () => {
    testCases.claim_tests.forEach((testCase) => {
      it(`should extract correct claims: ${testCase.name}`, async () => {
        const response = await mockPipeline.extractClaims(testCase.input);
        expect(response.data).toEqual(testCase.expected);
      });
    });
  });

  describe('Full Pipeline Integration', () => {
    it('should process complete pipeline with sample input', async () => {
      const comments = testCases.sample_inputs.dupes_pets_5;
      
      // Step 1: Generate Topic Tree
      const treeResponse = await mockPipeline.generateTopicTree({
        llm: {
          model_name: "gpt-4-turbo-preview",
          system_prompt: "You are a professional research assistant.",
          user_prompt: "Create a topic tree from these comments.",
          api_key: process.env.OPENAI_API_KEY!
        },
        comments
      });
      expect(treeResponse.status).toBe(200);
      
      // Step 2: Extract Claims
      const claimsResponse = await mockPipeline.extractClaims({
        llm: {
          model_name: "gpt-4-turbo-preview",
          system_prompt: "You are a professional research assistant.",
          user_prompt: "Extract claims from these comments.",
          api_key: process.env.OPENAI_API_KEY!
        },
        comments,
        tree: { taxonomy: treeResponse.data }
      });
      expect(claimsResponse.status).toBe(200);
      
      // Step 3: Sort and Deduplicate Claims
      const sortResponse = await mockPipeline.sortClaimsTree({
        llm: {
          model_name: "gpt-4-turbo-preview",
          system_prompt: "You are a professional research assistant.",
          user_prompt: "Sort and deduplicate these claims.",
          api_key: process.env.OPENAI_API_KEY!
        },
        tree: claimsResponse.data,
        sort: "numPeople"
      });
      expect(sortResponse.status).toBe(200);
    });
  });
}); 