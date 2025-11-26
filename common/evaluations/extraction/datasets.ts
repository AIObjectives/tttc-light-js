// Sample taxonomy for extraction evaluation
export const sampleTaxonomy = [
  {
    topicName: "Pets",
    topicShortDescription: "Views on various pets",
    subtopics: [
      {
        subtopicName: "Cats",
        subtopicShortDescription: "Positive feelings and appreciation for cats",
      },
      {
        subtopicName: "Dogs",
        subtopicShortDescription:
          "Strong affection for dogs, indicated by enthusiastic comments",
      },
      {
        subtopicName: "Birds",
        subtopicShortDescription:
          "Uncertainty or mixed feelings regarding keeping birds as pets",
      },
    ],
  },
];

// Sample comments and expected extractions
export const sampleExtractionData = {
  input: {
    comment:
      "I love cats because they are independent and low-maintenance pets",
    taxonomy: sampleTaxonomy,
  },
  expectedOutput: {
    claims: [
      {
        claim: "Cats are superior pets due to their independence",
        quote:
          "I love cats because they are independent and low-maintenance pets",
        topicName: "Pets",
        subtopicName: "Cats",
      },
    ],
  },
};

// Additional test cases
export const extractionTestCases = [
  {
    id: "extraction-1",
    comment:
      "I love cats because they are independent and low-maintenance pets",
    taxonomy: sampleTaxonomy,
    expectedClaims: [
      {
        claim: "Cats are superior pets due to their independence",
        quote:
          "I love cats because they are independent and low-maintenance pets",
        topicName: "Pets",
        subtopicName: "Cats",
      },
    ],
  },
  {
    id: "extraction-2",
    comment: "Dogs are amazing companions and I really really love them",
    taxonomy: sampleTaxonomy,
    expectedClaims: [
      {
        claim: "Dogs make excellent companions",
        quote: "Dogs are amazing companions and I really really love them",
        topicName: "Pets",
        subtopicName: "Dogs",
      },
    ],
  },
  {
    id: "extraction-3",
    comment: "I am not sure about birds, they seem difficult to care for",
    taxonomy: sampleTaxonomy,
    expectedClaims: [
      {
        claim: "Birds are challenging pets to maintain",
        quote: "I am not sure about birds, they seem difficult to care for",
        topicName: "Pets",
        subtopicName: "Birds",
      },
    ],
  },
  {
    id: "extraction-4",
    comment: "Today I had a nice walk in the park and saw some flowers",
    taxonomy: sampleTaxonomy,
    expectedClaims: [], // Should extract zero claims - just a description, no debatable position
  },
];
