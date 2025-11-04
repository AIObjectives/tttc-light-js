import type { SortedTopic } from "../../apiPyserver";

// Dataset 1: Pet preferences
const petTopicsData: SortedTopic = [
  "Pets",
  {
    counts: { claims: 4, speakers: 2 },
    topics: [
      [
        "Cats",
        {
          counts: { claims: 2, speakers: 1 },
          claims: [
            {
              claim: "Cats are independent and low-maintenance pets",
              quote: "Cats don't need as much attention as dogs",
              speaker: "user1",
              topicName: "Pets",
              subtopicName: "Cats",
              commentId: "c1",
              duplicates: [],
            },
            {
              claim: "Cats provide emotional support and companionship",
              quote: "My cat is always there when I need comfort",
              speaker: "user1",
              topicName: "Pets",
              subtopicName: "Cats",
              commentId: "c1",
              duplicates: [],
            },
          ],
        },
      ],
      [
        "Dogs",
        {
          counts: { claims: 2, speakers: 1 },
          claims: [
            {
              claim: "Dogs require significant time and attention",
              quote: "Dogs need regular walks and constant care",
              speaker: "user2",
              topicName: "Pets",
              subtopicName: "Dogs",
              commentId: "c2",
              duplicates: [],
            },
            {
              claim: "Dogs are loyal and protective companions",
              quote: "My dog is incredibly loyal and protective of our family",
              speaker: "user2",
              topicName: "Pets",
              subtopicName: "Dogs",
              commentId: "c2",
              duplicates: [],
            },
          ],
        },
      ],
    ],
  },
];

// Dataset 2: Restaurant experiences
const restaurantTopicsData: SortedTopic = [
  "Downtown Restaurant Experience",
  {
    counts: { claims: 8, speakers: 3 },
    topics: [
      [
        "Food Quality",
        {
          counts: { claims: 3, speakers: 1 },
          claims: [
            {
              claim: "Fresh ingredients make a significant difference in taste",
              quote: "The fresh ingredients really enhanced the flavor",
              speaker: "user3",
              topicName: "Downtown Restaurant Experience",
              subtopicName: "Food Quality",
              commentId: "c3",
              duplicates: [],
            },
            {
              claim:
                "Portion sizes are too small for the prices charged at many restaurants",
              quote:
                "The portions were quite small considering the high prices",
              speaker: "user3",
              topicName: "Downtown Restaurant Experience",
              subtopicName: "Food Quality",
              commentId: "c3",
              duplicates: [],
            },
            {
              claim: "Menu variety is limited for vegetarian options",
              quote: "There weren't many vegetarian choices on the menu",
              speaker: "user3",
              topicName: "Downtown Restaurant Experience",
              subtopicName: "Food Quality",
              commentId: "c3",
              duplicates: [],
            },
          ],
        },
      ],
      [
        "Service Quality",
        {
          counts: { claims: 3, speakers: 1 },
          claims: [
            {
              claim: "Wait times during peak hours are excessively long",
              quote: "We waited over an hour during dinner rush",
              speaker: "user4",
              topicName: "Downtown Restaurant Experience",
              subtopicName: "Service Quality",
              commentId: "c4",
              duplicates: [],
            },
            {
              claim: "Staff are generally friendly but often seem understaffed",
              quote: "The servers were nice but clearly overwhelmed",
              speaker: "user4",
              topicName: "Downtown Restaurant Experience",
              subtopicName: "Service Quality",
              commentId: "c4",
              duplicates: [],
            },
            {
              claim: "Reservation systems need improvement for busy nights",
              quote: "The reservation system was confusing and unreliable",
              speaker: "user4",
              topicName: "Downtown Restaurant Experience",
              subtopicName: "Service Quality",
              commentId: "c4",
              duplicates: [],
            },
          ],
        },
      ],
      [
        "Ambiance and Atmosphere",
        {
          counts: { claims: 2, speakers: 1 },
          claims: [
            {
              claim: "Noise levels make conversation difficult in many venues",
              quote: "It was so loud we could barely hear each other",
              speaker: "user5",
              topicName: "Downtown Restaurant Experience",
              subtopicName: "Ambiance and Atmosphere",
              commentId: "c5",
              duplicates: [],
            },
            {
              claim:
                "Outdoor seating options are appreciated during good weather",
              quote: "The patio seating was lovely on a sunny day",
              speaker: "user5",
              topicName: "Downtown Restaurant Experience",
              subtopicName: "Ambiance and Atmosphere",
              commentId: "c5",
              duplicates: [],
            },
          ],
        },
      ],
    ],
  },
];

// Dataset 3: Public transportation feedback
const publicTransportationData: SortedTopic = [
  "Public Transportation",
  {
    counts: { claims: 5, speakers: 2 },
    topics: [
      [
        "Bus System",
        {
          counts: { claims: 3, speakers: 1 },
          claims: [
            {
              claim: "Bus routes don't adequately cover suburban neighborhoods",
              quote: "Our suburb has very limited bus service",
              speaker: "user6",
              topicName: "Public Transportation",
              subtopicName: "Bus System",
              commentId: "c6",
              duplicates: [],
            },
            {
              claim: "Buses are frequently delayed or arrive off-schedule",
              quote: "The buses are never on time",
              speaker: "user6",
              topicName: "Public Transportation",
              subtopicName: "Bus System",
              commentId: "c6",
              duplicates: [],
            },
            {
              claim:
                "Weekend service is insufficient for non-work-related travel needs",
              quote: "Weekend bus schedules make it hard to get around",
              speaker: "user6",
              topicName: "Public Transportation",
              subtopicName: "Bus System",
              commentId: "c6",
              duplicates: [],
            },
          ],
        },
      ],
      [
        "Metro/Subway",
        {
          counts: { claims: 2, speakers: 1 },
          claims: [
            {
              claim: "Metro stations need better maintenance and cleaning",
              quote: "The stations are dirty and poorly maintained",
              speaker: "user7",
              topicName: "Public Transportation",
              subtopicName: "Metro/Subway",
              commentId: "c7",
              duplicates: [],
            },
            {
              claim:
                "Train frequency during off-peak hours should be increased",
              quote: "Trains run too infrequently outside rush hour",
              speaker: "user7",
              topicName: "Public Transportation",
              subtopicName: "Metro/Subway",
              commentId: "c7",
              duplicates: [],
            },
          ],
        },
      ],
    ],
  },
];

// Test cases for summaries evaluation
export const summariesTestCases = [
  {
    id: "summaries-1",
    topic: petTopicsData,
  },
  {
    id: "summaries-2",
    topic: restaurantTopicsData,
  },
  {
    id: "summaries-3",
    topic: publicTransportationData,
  },
];
