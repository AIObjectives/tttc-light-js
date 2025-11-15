// Dataset 1: Pet preferences
const petTopicsData = [
  {
    topicName: "Pets",
    topicShortDescription: "General attitudes and preferences about pets",
    subtopics: [
      {
        subtopicName: "Cats",
        subtopicShortDescription: "Opinions and experiences with cats as pets",
        claims: [
          { claimText: "Cats are independent and low-maintenance pets" },
          { claimText: "Cats provide emotional support and companionship" },
        ],
      },
      {
        subtopicName: "Dogs",
        subtopicShortDescription: "Opinions and experiences with dogs as pets",
        claims: [
          { claimText: "Dogs require significant time and attention" },
          { claimText: "Dogs are loyal and protective companions" },
        ],
      },
    ],
  },
];

// Dataset 2: Restaurant experiences
const restaurantTopicsData = [
  {
    topicName: "Downtown Restaurant Experience",
    topicShortDescription:
      "Customer feedback on various aspects of downtown restaurants",
    subtopics: [
      {
        subtopicName: "Food Quality",
        subtopicShortDescription: "Perspectives on meal quality and taste",
        claims: [
          {
            claimText:
              "Fresh ingredients make a significant difference in taste",
          },
          {
            claimText:
              "Portion sizes are too small for the prices charged at many restaurants",
          },
          { claimText: "Menu variety is limited for vegetarian options" },
        ],
      },
      {
        subtopicName: "Service Quality",
        subtopicShortDescription:
          "Experiences with restaurant staff and service",
        claims: [
          { claimText: "Wait times during peak hours are excessively long" },
          {
            claimText:
              "Staff are generally friendly but often seem understaffed",
          },
          { claimText: "Reservation systems need improvement for busy nights" },
        ],
      },
      {
        subtopicName: "Ambiance and Atmosphere",
        subtopicShortDescription:
          "Feedback on restaurant environment and setting",
        claims: [
          {
            claimText:
              "Noise levels make conversation difficult in many venues",
          },
          {
            claimText:
              "Outdoor seating options are appreciated during good weather",
          },
        ],
      },
    ],
  },
];

// Dataset 3: City services feedback
const cityServicesTopicsData = [
  {
    topicName: "Public Transportation",
    topicShortDescription: "Resident perspectives on public transit services",
    subtopics: [
      {
        subtopicName: "Bus System",
        subtopicShortDescription:
          "Experiences and opinions about bus routes and service",
        claims: [
          {
            claimText:
              "Bus routes don't adequately cover suburban neighborhoods",
          },
          { claimText: "Buses are frequently delayed or arrive off-schedule" },
          {
            claimText:
              "Weekend service is insufficient for non-work-related travel needs",
          },
        ],
      },
      {
        subtopicName: "Metro/Subway",
        subtopicShortDescription: "Feedback on rail transit system",
        claims: [
          { claimText: "Metro stations need better maintenance and cleaning" },
          {
            claimText:
              "Train frequency during off-peak hours should be increased",
          },
        ],
      },
    ],
  },
  {
    topicName: "Parks and Recreation",
    topicShortDescription:
      "Community views on parks and recreational facilities",
    subtopics: [
      {
        subtopicName: "Park Maintenance",
        subtopicShortDescription: "Concerns about upkeep of public parks",
        claims: [
          {
            claimText:
              "Regular maintenance of playgrounds is needed for child safety",
          },
          {
            claimText:
              "Parks are generally well-maintained but need more trash bins",
          },
        ],
      },
      {
        subtopicName: "Recreation Programs",
        subtopicShortDescription: "Opinions on city-organized activities",
        claims: [
          {
            claimText:
              "Youth sports programs are valuable but have limited availability",
          },
          {
            claimText:
              "Senior citizen programs offer good variety and are well-attended",
          },
        ],
      },
    ],
  },
];

// Test cases for summaries evaluation
export const summariesTestCases = [
  {
    id: "summaries-1",
    topics: petTopicsData,
  },
  {
    id: "summaries-2",
    topics: restaurantTopicsData,
  },
  {
    id: "summaries-3",
    topics: cityServicesTopicsData,
  },
];
