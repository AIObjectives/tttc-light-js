import * as schema from "tttc-common/schema";

export const taxonomyObject: schema.Taxonomy = [
  {
    topicName: "Lorem Ipsum",
    topicShortDescription: "Dolor sit amet consectetur adipiscing elit",
    topicId: "topic1",
    claimsCount: 10,
    subtopics: [
      {
        subtopicName: "Sed do eiusmod",
        subtopicShortDescription:
          "Tempor incididunt ut labore et dolore magna aliqua",
        subtopicId: "subtopic1",
        claimsCount: 5,
        claims: [
          {
            claim: "Ut enim ad minim veniam",
            quote:
              "Quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat",
            claimId: "claim1",
            topicName: "Lorem Ipsum",
            subtopicName: "Sed do eiusmod",
            commentId: "comment1",
            duplicates: [
              {
                claim: "Duis aute irure dolor in reprehenderit",
                quote:
                  "In voluptate velit esse cillum dolore eu fugiat nulla pariatur",
                claimId: "claim2",
                topicName: "Lorem Ipsum",
                subtopicName: "Sed do eiusmod",
                commentId: "comment2",
                duplicated: true,
              },
            ],
          },
          {
            claim: "Excepteur sint occaecat cupidatat non proident",
            quote:
              "Sunt in culpa qui officia deserunt mollit anim id est laborum",
            claimId: "claim3",
            topicName: "Lorem Ipsum",
            subtopicName: "Sed do eiusmod",
            commentId: "comment3",
          },
        ],
      },
      {
        subtopicName: "Ut enim ad minima veniam",
        subtopicShortDescription:
          "Quis nostrum exercitationem ullam corporis suscipit laboriosam",
        subtopicId: "subtopic2",
        claimsCount: 3,
        claims: [
          {
            claim: "Nisi ut aliquid ex ea commodi consequatur",
            quote:
              "Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur",
            claimId: "claim4",
            topicName: "Lorem Ipsum",
            subtopicName: "Ut enim ad minima veniam",
            commentId: "comment4",
          },
        ],
      },
    ],
  },
  {
    topicName: "Sed ut perspiciatis",
    topicShortDescription:
      "Unde omnis iste natus error sit voluptatem accusantium doloremque laudantium",
    topicId: "topic2",
    claimsCount: 8,
    subtopics: [
      {
        subtopicName: "Totam rem aperiam",
        subtopicShortDescription:
          "Eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo",
        subtopicId: "subtopic3",
        claimsCount: 4,
        claims: [
          {
            claim:
              "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit",
            quote:
              "Sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt",
            claimId: "claim5",
            topicName: "Sed ut perspiciatis",
            subtopicName: "Totam rem aperiam",
            commentId: "comment5",
          },
        ],
      },
    ],
  },
];
