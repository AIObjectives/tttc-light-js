// Dataset 1: Healthcare Reform
const healthcareParticipantClaims = [
  {
    participant: "Person 1",
    claims: [
      "Government intervention in healthcare is necessary to ensure universal coverage",
      "Private insurance companies prioritize profits over patient care",
    ],
  },
  {
    participant: "Person 2",
    claims: [
      "Market-based healthcare solutions are more efficient than government programs",
      "Individual choice in healthcare is essential for quality outcomes",
    ],
  },
  {
    participant: "Person 3",
    claims: [
      "Healthcare is a fundamental right that should be guaranteed to all citizens",
      "Current healthcare costs are unsustainable for middle-class families",
    ],
  },
];

// Dataset 2: Climate Policy
const climateParticipantClaims = [
  {
    participant: "A",
    claims: [
      "Carbon taxes are necessary to incentivize emission reductions",
      "The cost of climate inaction outweighs the economic burden of regulation",
    ],
  },
  {
    participant: "B",
    claims: [
      "Carbon pricing will harm economic competitiveness",
      "Market innovation, not taxation, should drive emission reductions",
    ],
  },
  {
    participant: "C",
    claims: [
      "We need aggressive carbon pricing to meet climate targets",
      "Industry lobbying has blocked effective climate policy for too long",
    ],
  },
];

// Test cases for crux evaluation
export const cruxTestCases = [
  {
    id: "crux-1",
    topic: "Healthcare Reform",
    topicDescription: "Views on healthcare policy and access",
    subtopic: "Universal Coverage",
    subtopicDescription:
      "Perspectives on whether government should guarantee healthcare for all",
    participantClaims: healthcareParticipantClaims,
  },
  {
    id: "crux-2",
    topic: "Climate Policy",
    topicDescription: "Views on climate change and environmental regulation",
    subtopic: "Carbon Pricing",
    subtopicDescription:
      "Perspectives on carbon taxes and cap-and-trade systems",
    participantClaims: climateParticipantClaims,
  },
];
