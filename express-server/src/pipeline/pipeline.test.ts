import { describe, it, expect } from "vitest";
import * as apiPyserver from "tttc-common/apiPyserver";
import { claimsPipelineStep } from "./claimsStep";
import { sortClaimsTreePipelineStep } from "./sortClaimsTree";
import { topicTreePipelineStep } from "./topicTreeStep";
import {
  defaultSystemPrompt,
  defaultClusteringPrompt,
  defaultExtractionPrompt,
  defaultDedupPrompt,
} from "tttc-common/prompts";

// tests setup
const env = {
  PYSERVER_URL: "http://localhost:8000",
};

const testCommentData = {
  comments: [
    { text: "The new phone has amazing battery life" },
    { text: "This phone's battery performance is incredible" },
    { text: "Check out my sourdough bread recipe from grandma" },
    { text: "Here's my grandmother's special sourdough recipe" },
    { text: "The weather in Seattle is always rainy" },
    { text: "Training my dog took patience but worth it" },
    { text: "It takes patience to train a dog but the results are rewarding" },
    { text: "Just watched the latest superhero movie" },
    { text: "The new superhero film was entertaining" },
    { text: "Learning to code changed my career path" },
    { text: "Programming skills transformed my career trajectory" },
    { text: "Coffee helps me stay productive" },
    { text: "Found a great spot for hiking today" },
    { text: "This yoga routine really improved my flexibility" },
    {
      text: "My flexibility has gotten so much better with this yoga practice",
    },
    { text: "The pasta sauce recipe needs more garlic" },
    { text: "This sauce recipe could use extra garlic" },
    { text: "My garden tomatoes grew really well this year" },
    { text: "The tomatoes in my garden thrived this season" },
    { text: "Just finished reading an amazing mystery novel" },
    { text: "The mystery book I just read was fantastic" },
    { text: "Planning a trip to Japan next spring" },
    { text: "Organizing my Japan vacation for next spring" },
    { text: "Started learning piano last month" },
    { text: "Began taking piano lessons recently" },
    { text: "The local farmer's market has great produce" },
  ].map((com, i) => ({ ...com, id: `cm-${i}` })),
};

const testTaxonomyData = {
  taxonomy: [
    {
      topicName: "Technology",
      topicShortDescription:
        "Comments related to gadgets and their performance.",
      subtopics: [
        {
          subtopicName: "Smartphones",
          subtopicShortDescription:
            "Insights on phone features and performance.",
        },
      ],
    },
    {
      topicName: "Food & Recipes",
      topicShortDescription: "Comments about cooking and recipes.",
      subtopics: [
        {
          subtopicName: "Baking",
          subtopicShortDescription:
            "Discussions on baking recipes and techniques.",
        },
        {
          subtopicName: "Cooking Tips",
          subtopicShortDescription: "Suggestions for improving recipes.",
        },
        {
          subtopicName: "Gardening",
          subtopicShortDescription: "Comments on home gardening and produce.",
        },
      ],
    },
    {
      topicName: "Weather",
      topicShortDescription: "Comments about weather conditions.",
      subtopics: [
        {
          subtopicName: "Rainy Weather",
          subtopicShortDescription:
            "Observations about rainy conditions in specific locations.",
        },
      ],
    },
    {
      topicName: "Pets",
      topicShortDescription: "Comments related to pet training and care.",
      subtopics: [
        {
          subtopicName: "Dog Training",
          subtopicShortDescription: "Experiences and tips on training dogs.",
        },
      ],
    },
    {
      topicName: "Entertainment",
      topicShortDescription: "Comments about movies and books.",
      subtopics: [
        {
          subtopicName: "Movies",
          subtopicShortDescription: "Reviews and opinions on films.",
        },
        {
          subtopicName: "Books",
          subtopicShortDescription:
            "Recommendations and reviews of literature.",
        },
      ],
    },
    {
      topicName: "Travel",
      topicShortDescription: "Comments about travel plans and experiences.",
      subtopics: [
        {
          subtopicName: "Trip Planning",
          subtopicShortDescription:
            "Discussions on organizing travel itineraries.",
        },
      ],
    },
    {
      topicName: "Hobbies",
      topicShortDescription:
        "Comments about personal interests and activities.",
      subtopics: [
        {
          subtopicName: "Music",
          subtopicShortDescription:
            "Experiences related to learning musical instruments.",
        },
        {
          subtopicName: "Fitness",
          subtopicShortDescription: "Insights on yoga and physical activities.",
        },
      ],
    },
    {
      topicName: "Food & Markets",
      topicShortDescription: "Comments about local food sources and markets.",
      subtopics: [
        {
          subtopicName: "Farmers' Markets",
          subtopicShortDescription:
            "Observations about local produce and markets.",
        },
      ],
    },
  ],
};

const testDedupTree: apiPyserver.SortClaimsTreeRequest["tree"] = {
  Technology: {
    total: 4,
    subtopics: {
      Smartphones: {
        total: 4,
        claims: [
          {
            claim: "Long battery life is a crucial feature for smartphones.",
            quote: "The new phone has amazing battery life.",
            topicName: "Technology",
            subtopicName: "Smartphones",
            commentId: "c1",
          },
          {
            claim: "Smartphones can have exceptional battery performance.",
            quote: "This phone's battery performance is incredible",
            topicName: "Technology",
            subtopicName: "Smartphones",
            commentId: "c2",
          },
          {
            claim:
              "Learning to code can significantly alter one's career trajectory.",
            quote: "Learning to code changed my career path.",
            topicName: "Technology",
            subtopicName: "Smartphones",
            commentId: "c10",
          },
          {
            claim: "Programming skills are essential for career advancement.",
            quote: "Programming skills transformed my career trajectory.",
            topicName: "Technology",
            subtopicName: "Smartphones",
            commentId: "c11",
          },
        ],
      },
    },
  },
  "Food & Recipes": {
    total: 7,
    subtopics: {
      Baking: {
        total: 2,
        claims: [
          {
            claim: "Traditional recipes are often superior to modern ones.",
            quote: "Check out my sourdough bread recipe from grandma",
            topicName: "Food & Recipes",
            subtopicName: "Baking",
            commentId: "c3",
          },
          {
            claim:
              "Traditional recipes are valuable for preserving culinary heritage.",
            quote: "Here's my grandmother's special sourdough recipe",
            topicName: "Food & Recipes",
            subtopicName: "Baking",
            commentId: "c4",
          },
        ],
      },
      "Cooking Tips": {
        total: 3,
        claims: [
          {
            claim: "Coffee enhances productivity.",
            quote: "Coffee helps me stay productive.",
            topicName: "Food & Recipes",
            subtopicName: "Cooking Tips",
            commentId: "c12",
          },
          {
            claim: "Pasta sauce recipes should include more garlic.",
            quote: "The pasta sauce recipe needs more garlic.",
            topicName: "Food & Recipes",
            subtopicName: "Cooking Tips",
            commentId: "c16",
          },
          {
            claim: "Recipes should be adaptable to personal taste.",
            quote: "This sauce recipe could use extra garlic.",
            topicName: "Food & Recipes",
            subtopicName: "Cooking Tips",
            commentId: "c17",
          },
        ],
      },
      Gardening: {
        total: 2,
        claims: [
          {
            claim: "Home gardening can yield successful produce.",
            quote: "My garden tomatoes grew really well this year.",
            topicName: "Food & Recipes",
            subtopicName: "Gardening",
            commentId: "c18",
          },
          {
            claim: "Home gardening can lead to successful produce.",
            quote: "The tomatoes in my garden thrived this season",
            topicName: "Food & Recipes",
            subtopicName: "Gardening",
            commentId: "c19",
          },
        ],
      },
    },
  },
  Weather: {
    total: 1,
    subtopics: {
      "Rainy Weather": {
        total: 1,
        claims: [
          {
            claim: "Seattle experiences frequent rainy weather.",
            quote: "The weather in Seattle is always rainy.",
            topicName: "Weather",
            subtopicName: "Rainy Weather",
            commentId: "c5",
          },
        ],
      },
    },
  },
  Pets: {
    total: 4,
    subtopics: {
      "Dog Training": {
        total: 4,
        claims: [
          {
            claim: "Training a dog requires patience.",
            quote: "Training my dog took patience [...].",
            topicName: "Pets",
            subtopicName: "Dog Training",
            commentId: "c6",
          },
          {
            claim: "The effort in dog training is worthwhile.",
            quote: "Training my dog [...] but worth it.",
            topicName: "Pets",
            subtopicName: "Dog Training",
            commentId: "c6",
          },
          {
            claim: "Training a dog requires patience.",
            quote: "It takes patience to train a dog...",
            topicName: "Pets",
            subtopicName: "Dog Training",
            commentId: "c7",
          },
          {
            claim: "The results of dog training are rewarding.",
            quote: "...but the results are rewarding.",
            topicName: "Pets",
            subtopicName: "Dog Training",
            commentId: "c7",
          },
        ],
      },
    },
  },
  Entertainment: {
    total: 4,
    subtopics: {
      Movies: {
        total: 2,
        claims: [
          {
            claim:
              "Superhero movies are a significant part of modern entertainment culture.",
            quote: "Just watched the latest superhero movie",
            topicName: "Entertainment",
            subtopicName: "Movies",
            commentId: "c8",
          },
          {
            claim: "Superhero films can be entertaining.",
            quote: "The new superhero film was entertaining.",
            topicName: "Entertainment",
            subtopicName: "Movies",
            commentId: "c9",
          },
        ],
      },
      Books: {
        total: 2,
        claims: [
          {
            claim:
              "Mystery novels provide a unique and engaging reading experience.",
            quote: "Just finished reading an amazing mystery novel",
            topicName: "Entertainment",
            subtopicName: "Books",
            commentId: "c20",
          },
          {
            claim: "Mystery books offer a unique reading experience.",
            quote: "The mystery book I just read was fantastic.",
            topicName: "Entertainment",
            subtopicName: "Books",
            commentId: "c21",
          },
        ],
      },
    },
  },
  Hobbies: {
    total: 5,
    subtopics: {
      Fitness: {
        total: 3,
        claims: [
          {
            claim: "Hiking is an essential outdoor activity for well-being.",
            quote: "Found a great spot for hiking today",
            topicName: "Hobbies",
            subtopicName: "Fitness",
            commentId: "c13",
          },
          {
            claim: "Yoga routines can significantly enhance flexibility.",
            quote: "This yoga routine really improved my flexibility.",
            topicName: "Hobbies",
            subtopicName: "Fitness",
            commentId: "c14",
          },
          {
            claim: "Yoga significantly improves flexibility.",
            quote:
              "My flexibility has gotten so much better with this yoga practice.",
            topicName: "Hobbies",
            subtopicName: "Fitness",
            commentId: "c15",
          },
        ],
      },
      Music: {
        total: 2,
        claims: [
          {
            claim:
              "Learning a musical instrument can be a rewarding experience.",
            quote: "Started learning piano last month",
            topicName: "Hobbies",
            subtopicName: "Music",
            commentId: "c24",
          },
          {
            claim: "Learning a musical instrument can enhance personal growth.",
            quote: "Began taking piano lessons recently.",
            topicName: "Hobbies",
            subtopicName: "Music",
            commentId: "c25",
          },
        ],
      },
    },
  },
  Travel: {
    total: 2,
    subtopics: {
      "Trip Planning": {
        total: 2,
        claims: [
          {
            claim: "Traveling to Japan in spring is a great idea.",
            quote: "Planning a trip to Japan next spring",
            topicName: "Travel",
            subtopicName: "Trip Planning",
            commentId: "c22",
          },
          {
            claim: "Travel planning requires careful organization.",
            quote: "Organizing my Japan vacation for next spring",
            topicName: "Travel",
            subtopicName: "Trip Planning",
            commentId: "c23",
          },
        ],
      },
    },
  },
  "Food & Markets": {
    total: 1,
    subtopics: {
      "Farmers' Markets": {
        total: 1,
        claims: [
          {
            claim: "Local farmers' markets offer high-quality produce.",
            quote: "The local farmer's market has great produce.",
            topicName: "Food & Markets",
            subtopicName: "Farmers' Markets",
            commentId: "c26",
          },
        ],
      },
    },
  },
};

const makeLLMConfig = (user_prompt: string) => ({
  system_prompt: defaultSystemPrompt,
  user_prompt,
  model_name: "gpt-4o-mini",
});

/**
 * Tests the different pipeline steps
 * - topicTreePipelineStep
 * - claimsPipelineStep
 * - sortClaimsTreePipelineStep
 */

// test topicTreePipelineStep with comment data
describe.skip("topicTreePipelineStep", () => {
  it("should return a topic tree", async () => {
    const body = {
      comments: testCommentData.comments,
      llm: makeLLMConfig(defaultClusteringPrompt),
    };

    const result = await topicTreePipelineStep(env, body);
    expect(result).toBeDefined();
    console.log(result);
    // expect zod to not throw an error
    expect(() => apiPyserver.topicTreeResponse.parse(result)).not.toThrow();
  });
});

// test claimsPipelineStep with comment data and taxonomy data
describe.skip("claimsPipelineStep", () => {
  it("should return a list of claims", async () => {
    const result = await claimsPipelineStep(env, {
      llm: makeLLMConfig(defaultExtractionPrompt),
      comments: testCommentData.comments,
      tree: testTaxonomyData,
    });
    expect(result).toBeDefined();
    // expect zod to not throw an error
    expect(() => apiPyserver.claimsReply.parse(result)).not.toThrow();
  });
});

// test sortClaimsTreePipelineStep with comment data and taxonomy data
describe.skip("sortClaimsTreePipelineStep", () => {
  it("should return a sorted list of claims", async () => {
    const result = await sortClaimsTreePipelineStep(env, {
      tree: testDedupTree,
      llm: makeLLMConfig(defaultDedupPrompt),
    });
    expect(result).toBeDefined();
    // expect zod to not throw an error
    expect(() =>
      apiPyserver.sortClaimsTreeResponse.parse(result),
    ).not.toThrow();
  });
});
