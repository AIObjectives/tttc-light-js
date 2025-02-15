export const mockResponses = {
  topicTree: {
    taxonomy: [{
      topicName: "Pets",
      topicShortDescription: "General opinions about common household pets.",
      subtopics: [
        {
          subtopicName: "Cats",
          subtopicShortDescription: "Positive sentiments towards cats."
        },
        {
          subtopicName: "Dogs",
          subtopicShortDescription: "Positive sentiments towards dogs."
        },
        {
          subtopicName: "Birds",
          subtopicShortDescription: "Uncertainty or mixed feelings about birds."
        }
      ]
    }]
  },
  
  claims: {
    Pets: {
      total: 3,
      subtopics: {
        Cats: {
          total: 1,
          claims: [{
            claim: "Cats are wonderful pets.",
            quote: "I love cats",
            topicName: "Pets",
            subtopicName: "Cats",
            commentId: "a"
          }]
        },
        Dogs: {
          total: 1,
          claims: [{
            claim: "Dogs make great pets.",
            quote: "dogs are great",
            topicName: "Pets",
            subtopicName: "Dogs",
            commentId: "b"
          }]
        },
        Birds: {
          total: 1,
          claims: [{
            claim: "Birds may not be suitable pets for everyone.",
            quote: "I'm not sure about birds",
            topicName: "Pets",
            subtopicName: "Birds",
            commentId: "c"
          }]
        }
      }
    }
  }
}; 