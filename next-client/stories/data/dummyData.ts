import * as schema from "tttc-common/schema";

export const reportData: schema.ReportDataObj = {
  title: "Lorem Ipsum Report",
  description: "A report filled with dummy data.",
  themes: [
    {
      id: "theme1",
      title: "Theme 1",
      description: "The first theme.",
      topics: [
        {
          id: "topic1",
          title: "Topic 1",
          description: "The first topic of Theme 1.",
          claims: Array.from({ length: 12 }, (_, i) => ({
            id: `claim1-${i}`,
            title: `Claim 1-${i}`,
            quotes: Array.from(
              { length: Math.floor(Math.random() * 3) + 1 },
              (_, j) => ({
                id: `quote1-${i}-${j}`,
                text: "Lorem ipsum dolor sit amet.",
                reference: {
                  id: `reference1-${i}-${j}`,
                  sourceId: `source1-${i}-${j}`,
                  data: ["text", { startIdx: 0, endIdx: 10 }],
                },
              }),
            ),
            similarClaimIds: [],
          })),
        },
        {
          id: "topic2",
          title: "Topic 2",
          description: "The second topic of Theme 1.",
          claims: Array.from({ length: 7 }, (_, i) => ({
            id: `claim2-${i}`,
            title: `Claim 2-${i}`,
            quotes: Array.from(
              { length: Math.floor(Math.random() * 3) + 1 },
              (_, j) => ({
                id: `quote2-${i}-${j}`,
                text: "Consectetur adipiscing elit.",
                reference: {
                  id: `reference2-${i}-${j}`,
                  sourceId: `source2-${i}-${j}`,
                  data: ["text", { startIdx: 0, endIdx: 10 }],
                },
              }),
            ),
            similarClaimIds: [],
          })),
        },
      ],
    },
    {
      id: "theme2",
      title: "Theme 2",
      description: "The second theme.",
      topics: [
        {
          id: "topic3",
          title: "Topic 3",
          description: "The first topic of Theme 2.",
          claims: Array.from({ length: 15 }, (_, i) => ({
            id: `claim3-${i}`,
            title: `Claim 3-${i}`,
            quotes: Array.from(
              { length: Math.floor(Math.random() * 3) + 1 },
              (_, j) => ({
                id: `quote3-${i}-${j}`,
                text: "Sed do eiusmod tempor incididunt.",
                reference: {
                  id: `reference3-${i}-${j}`,
                  sourceId: `source3-${i}-${j}`,
                  data: ["text", { startIdx: 0, endIdx: 10 }],
                },
              }),
            ),
            similarClaimIds: [],
          })),
        },
        {
          id: "topic4",
          title: "Topic 4",
          description: "The second topic of Theme 2.",
          claims: Array.from({ length: 9 }, (_, i) => ({
            id: `claim4-${i}`,
            title: `Claim 4-${i}`,
            quotes: Array.from(
              { length: Math.floor(Math.random() * 3) + 1 },
              (_, j) => ({
                id: `quote4-${i}-${j}`,
                text: "Ut labore et dolore magna aliqua.",
                reference: {
                  id: `reference4-${i}-${j}`,
                  sourceId: `source4-${i}-${j}`,
                  data: ["text", { startIdx: 0, endIdx: 10 }],
                },
              }),
            ),
            similarClaimIds: [],
          })),
        },
        {
          id: "topic5",
          title: "Topic 5",
          description: "The third topic of Theme 2.",
          claims: Array.from({ length: 6 }, (_, i) => ({
            id: `claim5-${i}`,
            title: `Claim 5-${i}`,
            quotes: Array.from(
              { length: Math.floor(Math.random() * 3) + 1 },
              (_, j) => ({
                id: `quote5-${i}-${j}`,
                text: "Duis aute irure dolor in reprehenderit.",
                reference: {
                  id: `reference5-${i}-${j}`,
                  sourceId: `source5-${i}-${j}`,
                  data: ["text", { startIdx: 0, endIdx: 10 }],
                },
              }),
            ),
            similarClaimIds: [],
          })),
        },
        {
          id: "topic6",
          title: "Topic 6",
          description: "The fourth topic of Theme 2.",
          claims: Array.from({ length: 8 }, (_, i) => ({
            id: `claim6-${i}`,
            title: `Claim 6-${i}`,
            quotes: Array.from(
              { length: Math.floor(Math.random() * 3) + 1 },
              (_, j) => ({
                id: `quote6-${i}-${j}`,
                text: "Excepteur sint occaecat cupidatat non proident.",
                reference: {
                  id: `reference6-${i}-${j}`,
                  sourceId: `source6-${i}-${j}`,
                  data: ["text", { startIdx: 0, endIdx: 10 }],
                },
              }),
            ),
            similarClaimIds: [],
          })),
        },
      ],
    },
    {
      id: "theme3",
      title: "Theme 3",
      description: "The third theme.",
      topics: [
        {
          id: "topic7",
          title: "Topic 7",
          description: "The first topic of Theme 3.",
          claims: Array.from({ length: 11 }, (_, i) => ({
            id: `claim7-${i}`,
            title: `Claim 7-${i}`,
            quotes: Array.from(
              { length: Math.floor(Math.random() * 3) + 1 },
              (_, j) => ({
                id: `quote7-${i}-${j}`,
                text: "Sunt in culpa qui officia deserunt mollit anim id est laborum.",
                reference: {
                  id: `reference7-${i}-${j}`,
                  sourceId: `source7-${i}-${j}`,
                  data: ["text", { startIdx: 0, endIdx: 10 }],
                },
              }),
            ),
            similarClaimIds: [],
          })),
        },
        {
          id: "topic8",
          title: "Topic 8",
          description: "The second topic of Theme 3.",
          claims: Array.from({ length: 16 }, (_, i) => ({
            id: `claim8-${i}`,
            title: `Claim 8-${i}`,
            quotes: Array.from(
              { length: Math.floor(Math.random() * 3) + 1 },
              (_, j) => ({
                id: `quote8-${i}-${j}`,
                text: "Sed ut perspiciatis unde omnis iste natus error sit voluptatem.",
                reference: {
                  id: `reference8-${i}-${j}`,
                  sourceId: `source8-${i}-${j}`,
                  data: ["text", { startIdx: 0, endIdx: 10 }],
                },
              }),
            ),
            similarClaimIds: [],
          })),
        },
        {
          id: "topic9",
          title: "Topic 9",
          description: "The third topic of Theme 3.",
          claims: Array.from({ length: 13 }, (_, i) => ({
            id: `claim9-${i}`,
            title: `Claim 9-${i}`,
            quotes: Array.from(
              { length: Math.floor(Math.random() * 3) + 1 },
              (_, j) => ({
                id: `quote9-${i}-${j}`,
                text: "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.",
                reference: {
                  id: `reference9-${i}-${j}`,
                  sourceId: `source9-${i}-${j}`,
                  data: ["text", { startIdx: 0, endIdx: 10 }],
                },
              }),
            ),
            similarClaimIds: [],
          })),
        },
        {
          id: "topic10",
          title: "Topic 10",
          description: "The fourth topic of Theme 3.",
          claims: Array.from({ length: 9 }, (_, i) => ({
            id: `claim10-${i}`,
            title: `Claim 10-${i}`,
            quotes: Array.from(
              { length: Math.floor(Math.random() * 3) + 1 },
              (_, j) => ({
                id: `quote10-${i}-${j}`,
                text: "Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet.",
                reference: {
                  id: `reference10-${i}-${j}`,
                  sourceId: `source10-${i}-${j}`,
                  data: ["text", { startIdx: 0, endIdx: 10 }],
                },
              }),
            ),
            similarClaimIds: [],
          })),
        },
        {
          id: "topic11",
          title: "Topic 11",
          description: "The fifth topic of Theme 3.",
          claims: Array.from({ length: 14 }, (_, i) => ({
            id: `claim11-${i}`,
            title: `Claim 11-${i}`,
            quotes: Array.from(
              { length: Math.floor(Math.random() * 3) + 1 },
              (_, j) => ({
                id: `quote11-${i}-${j}`,
                text: "Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit.",
                reference: {
                  id: `reference11-${i}-${j}`,
                  sourceId: `source11-${i}-${j}`,
                  data: ["text", { startIdx: 0, endIdx: 10 }],
                },
              }),
            ),
            similarClaimIds: [],
          })),
        },
        {
          id: "topic12",
          title: "Topic 12",
          description: "The sixth topic of Theme 3.",
          claims: Array.from({ length: 7 }, (_, i) => ({
            id: `claim12-${i}`,
            title: `Claim 12-${i}`,
            quotes: Array.from(
              { length: Math.floor(Math.random() * 3) + 1 },
              (_, j) => ({
                id: `quote12-${i}-${j}`,
                text: "Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur.",
                reference: {
                  id: `reference12-${i}-${j}`,
                  sourceId: `source12-${i}-${j}`,
                  data: ["text", { startIdx: 0, endIdx: 10 }],
                },
              }),
            ),
            similarClaimIds: [],
          })),
        },
      ],
    },
    {
      id: "theme4",
      title: "Theme 4",
      description: "The fourth theme.",
      topics: [
        {
          id: "topic13",
          title: "Topic 13",
          description: "The first topic of Theme 4.",
          claims: Array.from({ length: 18 }, (_, i) => ({
            id: `claim13-${i}`,
            title: `Claim 13-${i}`,
            quotes: Array.from(
              { length: Math.floor(Math.random() * 3) + 1 },
              (_, j) => ({
                id: `quote13-${i}-${j}`,
                text: "At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum.",
                reference: {
                  id: `reference13-${i}-${j}`,
                  sourceId: `source13-${i}-${j}`,
                  data: ["text", { startIdx: 0, endIdx: 10 }],
                },
              }),
            ),
            similarClaimIds: [],
          })),
        },
        {
          id: "topic14",
          title: "Topic 14",
          description: "The second topic of Theme 4.",
          claims: Array.from({ length: 5 }, (_, i) => ({
            id: `claim14-${i}`,
            title: `Claim 14-${i}`,
            quotes: Array.from(
              { length: Math.floor(Math.random() * 3) + 1 },
              (_, j) => ({
                id: `quote14-${i}-${j}`,
                text: "Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat.",
                reference: {
                  id: `reference14-${i}-${j}`,
                  sourceId: `source14-${i}-${j}`,
                  data: ["text", { startIdx: 0, endIdx: 10 }],
                },
              }),
            ),
            similarClaimIds: [],
          })),
        },
        {
          id: "topic15",
          title: "Topic 15",
          description: "The third topic of Theme 4.",
          claims: Array.from({ length: 12 }, (_, i) => ({
            id: `claim15-${i}`,
            title: `Claim 15-${i}`,
            quotes: Array.from(
              { length: Math.floor(Math.random() * 3) + 1 },
              (_, j) => ({
                id: `quote15-${i}-${j}`,
                text: "Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias consequatur.",
                reference: {
                  id: `reference15-${i}-${j}`,
                  sourceId: `source15-${i}-${j}`,
                  data: ["text", { startIdx: 0, endIdx: 10 }],
                },
              }),
            ),
            similarClaimIds: [],
          })),
        },
        {
          id: "topic16",
          title: "Topic 16",
          description: "The fourth topic of Theme 4.",
          claims: Array.from({ length: 8 }, (_, i) => ({
            id: `claim16-${i}`,
            title: `Claim 16-${i}`,
            quotes: Array.from(
              { length: Math.floor(Math.random() * 3) + 1 },
              (_, j) => ({
                id: `quote16-${i}-${j}`,
                text: "Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet.",
                reference: {
                  id: `reference16-${i}-${j}`,
                  sourceId: `source16-${i}-${j}`,
                  data: ["text", { startIdx: 0, endIdx: 10 }],
                },
              }),
            ),
            similarClaimIds: [],
          })),
        },
        {
          id: "topic17",
          title: "Topic 17",
          description: "The fifth topic of Theme 4.",
          claims: Array.from({ length: 14 }, (_, i) => ({
            id: `claim17-${i}`,
            title: `Claim 17-${i}`,
            quotes: Array.from(
              { length: Math.floor(Math.random() * 3) + 1 },
              (_, j) => ({
                id: `quote17-${i}-${j}`,
                text: "Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias consequatur.",
                reference: {
                  id: `reference17-${i}-${j}`,
                  sourceId: `source17-${i}-${j}`,
                  data: ["text", { startIdx: 0, endIdx: 10 }],
                },
              }),
            ),
            similarClaimIds: [],
          })),
        },
        {
          id: "topic18",
          title: "Topic 18",
          description: "The sixth topic of Theme 4.",
          claims: Array.from({ length: 11 }, (_, i) => ({
            id: `claim18-${i}`,
            title: `Claim 18-${i}`,
            quotes: Array.from(
              { length: Math.floor(Math.random() * 3) + 1 },
              (_, j) => ({
                id: `quote18-${i}-${j}`,
                text: "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores.",
                reference: {
                  id: `reference18-${i}-${j}`,
                  sourceId: `source18-${i}-${j}`,
                  data: ["text", { startIdx: 0, endIdx: 10 }],
                },
              }),
            ),
            similarClaimIds: [],
          })),
        },
        {
          id: "topic19",
          title: "Topic 19",
          description: "The seventh topic of Theme 4.",
          claims: Array.from({ length: 7 }, (_, i) => ({
            id: `claim19-${i}`,
            title: `Claim 19-${i}`,
            quotes: Array.from(
              { length: Math.floor(Math.random() * 3) + 1 },
              (_, j) => ({
                id: `quote19-${i}-${j}`,
                text: "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores.",
                reference: {
                  id: `reference19-${i}-${j}`,
                  sourceId: `source19-${i}-${j}`,
                  data: ["text", { startIdx: 0, endIdx: 10 }],
                },
              }),
            ),
            similarClaimIds: [],
          })),
        },
        {
          id: "topic20",
          title: "Topic 20",
          description: "The eighth topic of Theme 4.",
          claims: Array.from({ length: 9 }, (_, i) => ({
            id: `claim20-${i}`,
            title: `Claim 20-${i}`,
            quotes: Array.from(
              { length: Math.floor(Math.random() * 3) + 1 },
              (_, j) => ({
                id: `quote20-${i}-${j}`,
                text: "Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat.",
                reference: {
                  id: `reference20-${i}-${j}`,
                  sourceId: `source20-${i}-${j}`,
                  data: ["text", { startIdx: 0, endIdx: 10 }],
                },
              }),
            ),
            similarClaimIds: [],
          })),
        },
      ],
    },
    {
      id: "theme5",
      title: "Theme 5",
      description: "The fifth theme.",
      topics: [
        {
          id: "topic21",
          title: "Topic 21",
          description: "The first topic of Theme 5.",
          claims: Array.from({ length: 13 }, (_, i) => ({
            id: `claim21-${i}`,
            title: `Claim 21-${i}`,
            quotes: Array.from(
              { length: Math.floor(Math.random() * 3) + 1 },
              (_, j) => ({
                id: `quote21-${i}-${j}`,
                text: "At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque.",
                reference: {
                  id: `reference21-${i}-${j}`,
                  sourceId: `source21-${i}-${j}`,
                  data: ["text", { startIdx: 0, endIdx: 10 }],
                },
              }),
            ),
            similarClaimIds: [],
          })),
        },
        {
          id: "topic22",
          title: "Topic 22",
          description: "The second topic of Theme 5.",
          claims: Array.from({ length: 16 }, (_, i) => ({
            id: `claim22-${i}`,
            title: `Claim 22-${i}`,
            quotes: Array.from(
              { length: Math.floor(Math.random() * 3) + 1 },
              (_, j) => ({
                id: `quote22-${i}-${j}`,
                text: "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.",
                reference: {
                  id: `reference22-${i}-${j}`,
                  sourceId: `source22-${i}-${j}`,
                  data: ["text", { startIdx: 0, endIdx: 10 }],
                },
              }),
            ),
            similarClaimIds: [],
          })),
        },
        {
          id: "topic23",
          title: "Topic 23",
          description: "The third topic of Theme 5.",
          claims: Array.from({ length: 8 }, (_, i) => ({
            id: `claim23-${i}`,
            title: `Claim 23-${i}`,
            quotes: Array.from(
              { length: Math.floor(Math.random() * 3) + 1 },
              (_, j) => ({
                id: `quote23-${i}-${j}`,
                text: "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.",
                reference: {
                  id: `reference23-${i}-${j}`,
                  sourceId: `source23-${i}-${j}`,
                  data: ["text", { startIdx: 0, endIdx: 10 }],
                },
              }),
            ),
            similarClaimIds: [],
          })),
        },
        {
          id: "topic24",
          title: "Topic 24",
          description: "The fourth topic of Theme 5.",
          claims: Array.from({ length: 11 }, (_, i) => ({
            id: `claim24-${i}`,
            title: `Claim 24-${i}`,
            quotes: Array.from(
              { length: Math.floor(Math.random() * 3) + 1 },
              (_, j) => ({
                id: `quote24-${i}-${j}`,
                text: "Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae.",
                reference: {
                  id: `reference24-${i}-${j}`,
                  sourceId: `source24-${i}-${j}`,
                  data: ["text", { startIdx: 0, endIdx: 10 }],
                },
              }),
            ),
            similarClaimIds: [],
          })),
        },
        {
          id: "topic25",
          title: "Topic 25",
          description: "The fifth topic of Theme 5.",
          claims: Array.from({ length: 7 }, (_, i) => ({
            id: `claim25-${i}`,
            title: `Claim 25-${i}`,
            quotes: Array.from(
              { length: Math.floor(Math.random() * 3) + 1 },
              (_, j) => ({
                id: `quote25-${i}-${j}`,
                text: "Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat.",
                reference: {
                  id: `reference25-${i}-${j}`,
                  sourceId: `source25-${i}-${j}`,
                  data: ["text", { startIdx: 0, endIdx: 10 }],
                },
              }),
            ),
            similarClaimIds: [],
          })),
        },
        {
          id: "topic26",
          title: "Topic 26",
          description: "The sixth topic of Theme 5.",
          claims: Array.from({ length: 5 }, (_, i) => ({
            id: `claim26-${i}`,
            title: `Claim 26-${i}`,
            quotes: Array.from(
              { length: Math.floor(Math.random() * 3) + 1 },
              (_, j) => ({
                id: `quote26-${i}-${j}`,
                text: "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam.",
                reference: {
                  id: `reference26-${i}-${j}`,
                  sourceId: `source26-${i}-${j}`,
                  data: ["text", { startIdx: 0, endIdx: 10 }],
                },
              }),
            ),
            similarClaimIds: [],
          })),
        },
        {
          id: "topic27",
          title: "Topic 27",
          description: "The seventh topic of Theme 5.",
          claims: Array.from({ length: 9 }, (_, i) => ({
            id: `claim27-${i}`,
            title: `Claim 27-${i}`,
            quotes: Array.from(
              { length: Math.floor(Math.random() * 3) + 1 },
              (_, j) => ({
                id: `quote27-${i}-${j}`,
                text: "Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus.",
                reference: {
                  id: `reference27-${i}-${j}`,
                  sourceId: `source27-${i}-${j}`,
                  data: ["text", { startIdx: 0, endIdx: 10 }],
                },
              }),
            ),
            similarClaimIds: [],
          })),
        },
        {
          id: "topic28",
          title: "Topic 28",
          description: "The eighth topic of Theme 5.",
          claims: Array.from({ length: 12 }, (_, i) => ({
            id: `claim28-${i}`,
            title: `Claim 28-${i}`,
            quotes: Array.from(
              { length: Math.floor(Math.random() * 3) + 1 },
              (_, j) => ({
                id: `quote28-${i}-${j}`,
                text: "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.",
                reference: {
                  id: `reference28-${i}-${j}`,
                  sourceId: `source28-${i}-${j}`,
                  data: ["text", { startIdx: 0, endIdx: 10 }],
                },
              }),
            ),
            similarClaimIds: [],
          })),
        },
        {
          id: "topic29",
          title: "Topic 29",
          description: "The ninth topic of Theme 5.",
          claims: Array.from({ length: 6 }, (_, i) => ({
            id: `claim29-${i}`,
            title: `Claim 29-${i}`,
            quotes: Array.from(
              { length: Math.floor(Math.random() * 3) + 1 },
              (_, j) => ({
                id: `quote29-${i}-${j}`,
                text: "At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident.",
                reference: {
                  id: `reference29-${i}-${j}`,
                  sourceId: `source29-${i}-${j}`,
                  data: ["text", { startIdx: 0, endIdx: 10 }],
                },
              }),
            ),
            similarClaimIds: [],
          })),
        },
        {
          id: "topic30",
          title: "Topic 30",
          description: "The tenth topic of Theme 5.",
          claims: Array.from({ length: 10 }, (_, i) => ({
            id: `claim30-${i}`,
            title: `Claim 30-${i}`,
            quotes: Array.from(
              { length: Math.floor(Math.random() * 3) + 1 },
              (_, j) => ({
                id: `quote30-${i}-${j}`,
                text: "Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae. Itaque earum rerum hic tenetur a sapiente delectus.",
                reference: {
                  id: `reference30-${i}-${j}`,
                  sourceId: `source30-${i}-${j}`,
                  data: ["text", { startIdx: 0, endIdx: 10 }],
                },
              }),
            ),
            similarClaimIds: [],
          })),
        },
      ],
    },
  ],
  sources: [],
  graphics: [
    "piechart",
    {
      title: "Lorem Ipsum Pie Chart",
      items: [
        { label: "Item 1", count: 10 },
        { label: "Item 2", count: 20 },
        { label: "Item 3", count: 30 },
        { label: "Item 4", count: 40 },
      ],
    },
  ],
  date: new Date(),
};
