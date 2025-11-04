// Sample claims for deduplication evaluation
export const sampleDeduplicationData = {
  input: {
    claims: [
      {
        claimId: "claim1",
        claimText: "Parking fees are too expensive for downtown workers",
        quoteText: "I can't afford to pay $20 a day for parking",
      },
      {
        claimId: "claim2",
        claimText: "The parking pass system is confusing and hard to navigate",
        quoteText:
          "I spent an hour trying to figure out how to buy a monthly pass",
      },
      {
        claimId: "claim3",
        claimText: "We need more parking spaces in the downtown area",
        quoteText:
          "I drive around for 30 minutes every morning looking for a spot",
      },
      {
        claimId: "claim4",
        claimText: "Public transit should be expanded to reduce car dependency",
        quoteText:
          "If we had better bus routes, people wouldn't need to drive downtown",
      },
    ],
  },
  expectedOutput: {
    groupedClaims: [
      {
        claimText: "Parking access and affordability need improvement",
        originalClaimIds: ["claim1", "claim2", "claim3"],
      },
      {
        claimText: "Public transit should be expanded to reduce car dependency",
        originalClaimIds: ["claim4"],
      },
    ],
  },
};

// Test cases for deduplication evaluation
export const deduplicationTestCases = [
  {
    id: "dedup-1",
    claims: [
      {
        claimId: "claim1",
        claimText: "Parking fees are too expensive for downtown workers",
        quoteText: "I can't afford to pay $20 a day for parking",
      },
      {
        claimId: "claim2",
        claimText: "The parking pass system is confusing and hard to navigate",
        quoteText:
          "I spent an hour trying to figure out how to buy a monthly pass",
      },
      {
        claimId: "claim3",
        claimText: "We need more parking spaces in the downtown area",
        quoteText:
          "I drive around for 30 minutes every morning looking for a spot",
      },
    ],
    expectedGroups: [
      {
        claimText: "Parking access and affordability need improvement",
        originalClaimIds: ["claim1", "claim2", "claim3"],
      },
    ],
  },
  {
    id: "dedup-2",
    claims: [
      {
        claimId: "claim1",
        claimText: "We should prioritize renewable energy investments",
        quoteText: "Solar and wind power are the future",
      },
      {
        claimId: "claim2",
        claimText: "The city should ban single-use plastic bags",
        quoteText: "Plastic bags are harming our environment",
      },
    ],
    expectedGroups: [
      {
        claimText: "We should prioritize renewable energy investments",
        originalClaimIds: ["claim1"],
      },
      {
        claimText: "The city should ban single-use plastic bags",
        originalClaimIds: ["claim2"],
      },
    ],
  },
  {
    id: "dedup-3",
    claims: [
      {
        claimId: "claim1",
        claimText: "The library should have longer hours on weekends",
        quoteText: "I work weekdays and can only visit on Saturday",
      },
      {
        claimId: "claim2",
        claimText: "Library hours should be extended in the evening",
        quoteText: "The library closes too early for working parents",
      },
      {
        claimId: "claim3",
        claimText: "We need more library staff to help with research",
        quoteText:
          "There's never anyone available when I need help finding books",
      },
    ],
    expectedGroups: [
      {
        claimText:
          "Library hours should be extended to better serve working people",
        originalClaimIds: ["claim1", "claim2"],
      },
      {
        claimText: "We need more library staff to help with research",
        originalClaimIds: ["claim3"],
      },
    ],
  },
];
