import * as schema from "tttc-common/schema";

export const reportData: schema.ReportDataObj = {
  title: "Lorem Ipsum Report",
  description: "Dummy data for testing purposes",
  themes: [
    {
      id: "theme1",
      title: "Theme 1",
      description: "Lorem ipsum dolor sit amet",
      topics: [
        {
          id: "topic1",
          title: "Topic 1",
          description: "Consectetur adipiscing elit",
          claims: [
            {
              id: "claim1",
              title: "Claim 1",
              quotes: [
                {
                  id: "quote1",
                  text: "Sed do eiusmod tempor incididunt",
                  reference: {
                    id: "ref1",
                    sourceId: "source1",
                    data: ["text", { startIdx: 0, endIdx: 30 }],
                  },
                },
                {
                  id: "quote2",
                  text: "Ut labore et dolore magna aliqua",
                  reference: {
                    id: "ref2",
                    sourceId: "source1",
                    data: ["text", { startIdx: 31, endIdx: 62 }],
                  },
                },
              ],
              similarClaimIds: ["claim2", "claim3"],
            },
            {
              id: "claim2",
              title: "Claim 2",
              quotes: [
                {
                  id: "quote3",
                  text: "Quis nostrud exercitation ullamco",
                  reference: {
                    id: "ref3",
                    sourceId: "source2",
                    data: ["text", { startIdx: 0, endIdx: 33 }],
                  },
                },
              ],
              similarClaimIds: ["claim1", "claim3"],
            },
            {
              id: "claim3",
              title: "Claim 3",
              quotes: [
                {
                  id: "quote4",
                  text: "Laboris nisi ut aliquip ex ea commodo",
                  reference: {
                    id: "ref4",
                    sourceId: "source2",
                    data: ["text", { startIdx: 34, endIdx: 70 }],
                  },
                },
              ],
              similarClaimIds: ["claim1", "claim2"],
            },
            {
              id: "claim4",
              title: "Claim 4",
              quotes: [
                {
                  id: "quote5",
                  text: "Duis aute irure dolor in reprehenderit",
                  reference: {
                    id: "ref5",
                    sourceId: "source3",
                    data: ["text", { startIdx: 0, endIdx: 39 }],
                  },
                },
                {
                  id: "quote6",
                  text: "In voluptate velit esse cillum dolore",
                  reference: {
                    id: "ref6",
                    sourceId: "source3",
                    data: ["text", { startIdx: 40, endIdx: 77 }],
                  },
                },
                {
                  id: "quote7",
                  text: "Eu fugiat nulla pariatur",
                  reference: {
                    id: "ref7",
                    sourceId: "source3",
                    data: ["text", { startIdx: 78, endIdx: 102 }],
                  },
                },
              ],
              similarClaimIds: ["claim5"],
            },
            {
              id: "claim5",
              title: "Claim 5",
              quotes: [
                {
                  id: "quote8",
                  text: "Excepteur sint occaecat cupidatat non proident",
                  reference: {
                    id: "ref8",
                    sourceId: "source4",
                    data: ["text", { startIdx: 0, endIdx: 46 }],
                  },
                },
              ],
              similarClaimIds: ["claim4"],
            },
          ],
        },
        {
          id: "topic2",
          title: "Topic 2",
          description: "Morbi tempus iaculis urna id volutpat lacus",
          claims: [
            {
              id: "claim6",
              title: "Claim 6",
              quotes: [
                {
                  id: "quote9",
                  text: "Laoreet sit amet cursus sit amet dictum",
                  reference: {
                    id: "ref9",
                    sourceId: "source5",
                    data: ["text", { startIdx: 0, endIdx: 40 }],
                  },
                },
                {
                  id: "quote10",
                  text: "Sit amet justo donec enim diam vulputate",
                  reference: {
                    id: "ref10",
                    sourceId: "source5",
                    data: ["text", { startIdx: 41, endIdx: 81 }],
                  },
                },
              ],
              similarClaimIds: [],
            },
            {
              id: "claim7",
              title: "Claim 7",
              quotes: [
                {
                  id: "quote11",
                  text: "Ut tristique et egestas quis ipsum suspendisse",
                  reference: {
                    id: "ref11",
                    sourceId: "source6",
                    data: ["text", { startIdx: 0, endIdx: 46 }],
                  },
                },
                {
                  id: "quote12",
                  text: "Ultrices gravida dictum fusce ut placerat",
                  reference: {
                    id: "ref12",
                    sourceId: "source6",
                    data: ["text", { startIdx: 47, endIdx: 87 }],
                  },
                },
                {
                  id: "quote13",
                  text: "Orci nulla pellentesque dignissim enim sit",
                  reference: {
                    id: "ref13",
                    sourceId: "source6",
                    data: ["text", { startIdx: 88, endIdx: 129 }],
                  },
                },
              ],
              similarClaimIds: ["claim8"],
            },
            {
              id: "claim8",
              title: "Claim 8",
              quotes: [
                {
                  id: "quote14",
                  text: "Amet nulla facilisi morbi tempus iaculis urna",
                  reference: {
                    id: "ref14",
                    sourceId: "source7",
                    data: ["text", { startIdx: 0, endIdx: 45 }],
                  },
                },
              ],
              similarClaimIds: ["claim7"],
            },
            {
              id: "claim9",
              title: "Claim 9",
              quotes: [
                {
                  id: "quote15",
                  text: "Id faucibus nisl tincidunt eget nullam non",
                  reference: {
                    id: "ref15",
                    sourceId: "source7",
                    data: ["text", { startIdx: 46, endIdx: 87 }],
                  },
                },
                {
                  id: "quote16",
                  text: "Nisi est sit amet facilisis magna etiam tempor",
                  reference: {
                    id: "ref16",
                    sourceId: "source7",
                    data: ["text", { startIdx: 88, endIdx: 133 }],
                  },
                },
              ],
              similarClaimIds: [],
            },
          ],
        },
      ],
    },
    {
      id: "theme2",
      title: "Theme 2",
      description: "Orci porta non pulvinar neque laoreet",
      topics: [
        {
          id: "topic3",
          title: "Topic 3",
          description: "Suspendisse potenti nullam ac tortor",
          claims: [
            {
              id: "claim10",
              title: "Claim 10",
              quotes: [
                {
                  id: "quote17",
                  text: "Vitae tempus quam pellentesque nec nam aliquam sem",
                  reference: {
                    id: "ref17",
                    sourceId: "source8",
                    data: ["text", { startIdx: 0, endIdx: 49 }],
                  },
                },
                {
                  id: "quote18",
                  text: "Et tortor at risus viverra adipiscing at in tellus",
                  reference: {
                    id: "ref18",
                    sourceId: "source8",
                    data: ["text", { startIdx: 50, endIdx: 98 }],
                  },
                },
                {
                  id: "quote19",
                  text: "Integer feugiat scelerisque varius morbi enim nunc",
                  reference: {
                    id: "ref19",
                    sourceId: "source8",
                    data: ["text", { startIdx: 99, endIdx: 147 }],
                  },
                },
              ],
              similarClaimIds: ["claim11", "claim12"],
            },
            {
              id: "claim11",
              title: "Claim 11",
              quotes: [
                {
                  id: "quote20",
                  text: "Faucibus purus in massa tempor nec feugiat nisl pretium",
                  reference: {
                    id: "ref20",
                    sourceId: "source9",
                    data: ["text", { startIdx: 0, endIdx: 53 }],
                  },
                },
                {
                  id: "quote21",
                  text: "Fusce ut placerat orci nulla pellentesque dignissim",
                  reference: {
                    id: "ref21",
                    sourceId: "source9",
                    data: ["text", { startIdx: 54, endIdx: 102 }],
                  },
                },
              ],
              similarClaimIds: ["claim10", "claim12"],
            },
            {
              id: "claim12",
              title: "Claim 12",
              quotes: [
                {
                  id: "quote22",
                  text: "Enim sit amet venenatis urna cursus eget nunc",
                  reference: {
                    id: "ref22",
                    sourceId: "source10",
                    data: ["text", { startIdx: 0, endIdx: 45 }],
                  },
                },
              ],
              similarClaimIds: ["claim10", "claim11"],
            },
          ],
        },
        {
          id: "topic4",
          title: "Topic 4",
          description: "Scelerisque eleifend donec pretium vulputate",
          claims: [
            {
              id: "claim13",
              title: "Claim 13",
              quotes: [
                {
                  id: "quote23",
                  text: "Sapien nec sagittis aliquam malesuada bibendum arcu",
                  reference: {
                    id: "ref23",
                    sourceId: "source11",
                    data: ["text", { startIdx: 0, endIdx: 49 }],
                  },
                },
                {
                  id: "quote24",
                  text: "Vitae elementum curabitur vitae nunc sed velit dignissim",
                  reference: {
                    id: "ref24",
                    sourceId: "source11",
                    data: ["text", { startIdx: 50, endIdx: 104 }],
                  },
                },
              ],
              similarClaimIds: [],
            },
            {
              id: "claim14",
              title: "Claim 14",
              quotes: [
                {
                  id: "quote25",
                  text: "Sodales ut eu sem integer vitae justo eget magna",
                  reference: {
                    id: "ref25",
                    sourceId: "source12",
                    data: ["text", { startIdx: 0, endIdx: 48 }],
                  },
                },
                {
                  id: "quote26",
                  text: "Fermentum iaculis eu non diam phasellus",
                  reference: {
                    id: "ref26",
                    sourceId: "source12",
                    data: ["text", { startIdx: 49, endIdx: 86 }],
                  },
                },
                {
                  id: "quote27",
                  text: "Vestibulum rhoncus est pellentesque elit ullamcorper",
                  reference: {
                    id: "ref27",
                    sourceId: "source12",
                    data: ["text", { startIdx: 87, endIdx: 136 }],
                  },
                },
              ],
              similarClaimIds: ["claim15"],
            },
            {
              id: "claim15",
              title: "Claim 15",
              quotes: [
                {
                  id: "quote28",
                  text: "Dignissim cras tincidunt lobortis feugiat vivamus at",
                  reference: {
                    id: "ref28",
                    sourceId: "source13",
                    data: ["text", { startIdx: 0, endIdx: 50 }],
                  },
                },
                {
                  id: "quote29",
                  text: "Augue eget arcu dictum varius duis at consectetur lorem",
                  reference: {
                    id: "ref29",
                    sourceId: "source13",
                    data: ["text", { startIdx: 51, endIdx: 103 }],
                  },
                },
              ],
              similarClaimIds: ["claim14"],
            },
          ],
        },
        {
          id: "topic5",
          title: "Topic 5",
          description: "Donec massa sapien faucibus et molestie",
          claims: [
            {
              id: "claim16",
              title: "Claim 16",
              quotes: [
                {
                  id: "quote30",
                  text: "Ac turpis egestas maecenas pharetra convallis posuere",
                  reference: {
                    id: "ref30",
                    sourceId: "source14",
                    data: ["text", { startIdx: 0, endIdx: 51 }],
                  },
                },
                {
                  id: "quote31",
                  text: "Morbi non arcu risus quis varius quam quisque",
                  reference: {
                    id: "ref31",
                    sourceId: "source14",
                    data: ["text", { startIdx: 52, endIdx: 96 }],
                  },
                },
              ],
              similarClaimIds: [],
            },
            {
              id: "claim17",
              title: "Claim 17",
              quotes: [
                {
                  id: "quote32",
                  text: "Id aliquam etiam erat velit scelerisque in dictum non",
                  reference: {
                    id: "ref32",
                    sourceId: "source15",
                    data: ["text", { startIdx: 0, endIdx: 53 }],
                  },
                },
                {
                  id: "quote33",
                  text: "Consectetur nisi erat adipiscing elit proin risus praesent lectus",
                  reference: {
                    id: "ref33",
                    sourceId: "source15",
                    data: ["text", { startIdx: 54, endIdx: 114 }],
                  },
                },
                {
                  id: "quote34",
                  text: "Vestibulum ante ipsum primis in faucibus orci luctus",
                  reference: {
                    id: "ref34",
                    sourceId: "source15",
                    data: ["text", { startIdx: 115, endIdx: 168 }],
                  },
                },
              ],
              similarClaimIds: ["claim18"],
            },
            {
              id: "claim18",
              title: "Claim 18",
              quotes: [
                {
                  id: "quote35",
                  text: "Tincidunt eget nullam non nisi est sit amet facilisis",
                  reference: {
                    id: "ref35",
                    sourceId: "source16",
                    data: ["text", { startIdx: 0, endIdx: 53 }],
                  },
                },
              ],
              similarClaimIds: ["claim17"],
            },
          ],
        },
      ],
    },
    {
      id: "theme3",
      title: "Theme 3",
      description: "Magna etiam tempor orci eu lobortis",
      topics: [
        {
          id: "topic6",
          title: "Topic 6",
          description: "Elementum nibh tellus molestie nunc non",
          claims: [
            {
              id: "claim19",
              title: "Claim 19",
              quotes: [
                {
                  id: "quote36",
                  text: "Blandit cursus risus at ultrices mi tempus imperdiet nulla",
                  reference: {
                    id: "ref36",
                    sourceId: "source17",
                    data: ["text", { startIdx: 0, endIdx: 55 }],
                  },
                },
                {
                  id: "quote37",
                  text: "Malesuada proin libero nunc consequat interdum varius sit",
                  reference: {
                    id: "ref37",
                    sourceId: "source17",
                    data: ["text", { startIdx: 56, endIdx: 109 }],
                  },
                },
              ],
              similarClaimIds: [],
            },
            {
              id: "claim20",
              title: "Claim 20",
              quotes: [
                {
                  id: "quote38",
                  text: "Amet mattis vulputate enim nulla aliquet porttitor lacus",
                  reference: {
                    id: "ref38",
                    sourceId: "source18",
                    data: ["text", { startIdx: 0, endIdx: 54 }],
                  },
                },
                {
                  id: "quote39",
                  text: "Luctus accumsan tortor posuere ac ut consequat semper viverra",
                  reference: {
                    id: "ref39",
                    sourceId: "source18",
                    data: ["text", { startIdx: 55, endIdx: 112 }],
                  },
                },
                {
                  id: "quote40",
                  text: "Nam libero justo laoreet sit amet cursus sit amet",
                  reference: {
                    id: "ref40",
                    sourceId: "source18",
                    data: ["text", { startIdx: 113, endIdx: 161 }],
                  },
                },
              ],
              similarClaimIds: ["claim21"],
            },
            {
              id: "claim21",
              title: "Claim 21",
              quotes: [
                {
                  id: "quote41",
                  text: "Dictum sit amet justo donec enim diam vulputate ut",
                  reference: {
                    id: "ref41",
                    sourceId: "source19",
                    data: ["text", { startIdx: 0, endIdx: 50 }],
                  },
                },
              ],
              similarClaimIds: ["claim20"],
            },
          ],
        },
        {
          id: "topic7",
          title: "Topic 7",
          description: "Pharetra vel turpis nunc eget lorem dolor",
          claims: [
            {
              id: "claim22",
              title: "Claim 22",
              quotes: [
                {
                  id: "quote42",
                  text: "Sed faucibus turpis in eu mi bibendum neque egestas congue",
                  reference: {
                    id: "ref42",
                    sourceId: "source20",
                    data: ["text", { startIdx: 0, endIdx: 57 }],
                  },
                },
                {
                  id: "quote43",
                  text: "Quisque egestas diam in arcu cursus euismod quis",
                  reference: {
                    id: "ref43",
                    sourceId: "source20",
                    data: ["text", { startIdx: 58, endIdx: 105 }],
                  },
                },
              ],
              similarClaimIds: [],
            },
            {
              id: "claim23",
              title: "Claim 23",
              quotes: [
                {
                  id: "quote44",
                  text: "Viverra nam libero justo laoreet sit amet cursus sit",
                  reference: {
                    id: "ref44",
                    sourceId: "source21",
                    data: ["text", { startIdx: 0, endIdx: 51 }],
                  },
                },
                {
                  id: "quote45",
                  text: "Amet dictum sit amet justo donec enim diam vulputate ut",
                  reference: {
                    id: "ref45",
                    sourceId: "source21",
                    data: ["text", { startIdx: 52, endIdx: 104 }],
                  },
                },
              ],
              similarClaimIds: [],
            },
          ],
        },
      ],
    },
    {
      id: "theme4",
      title: "Theme 4",
      description: "Sed elementum tempus egestas sed sed risus",
      topics: [
        {
          id: "topic8",
          title: "Topic 8",
          description: "Pretium quam vulputate dignissim suspendisse",
          claims: [
            {
              id: "claim24",
              title: "Claim 24",
              quotes: [
                {
                  id: "quote46",
                  text: "In massa tempor nec feugiat nisl pretium fusce id velit",
                  reference: {
                    id: "ref46",
                    sourceId: "source22",
                    data: ["text", { startIdx: 0, endIdx: 55 }],
                  },
                },
                {
                  id: "quote47",
                  text: "Ut tortor pretium viverra suspendisse potenti nullam ac tortor",
                  reference: {
                    id: "ref47",
                    sourceId: "source22",
                    data: ["text", { startIdx: 56, endIdx: 114 }],
                  },
                },
                {
                  id: "quote48",
                  text: "Vitae semper quis lectus nulla at volutpat diam ut venenatis",
                  reference: {
                    id: "ref48",
                    sourceId: "source22",
                    data: ["text", { startIdx: 115, endIdx: 173 }],
                  },
                },
              ],
              similarClaimIds: [],
            },
            {
              id: "claim25",
              title: "Claim 25",
              quotes: [
                {
                  id: "quote49",
                  text: "Tellus molestie nunc non blandit massa enim nec dui nunc",
                  reference: {
                    id: "ref49",
                    sourceId: "source23",
                    data: ["text", { startIdx: 0, endIdx: 56 }],
                  },
                },
                {
                  id: "quote50",
                  text: "Mattis rhoncus urna neque viverra justo nec ultrices dui",
                  reference: {
                    id: "ref50",
                    sourceId: "source23",
                    data: ["text", { startIdx: 57, endIdx: 111 }],
                  },
                },
                {
                  id: "quote51",
                  text: "Sapien et ligula ullamcorper malesuada proin libero nunc",
                  reference: {
                    id: "ref51",
                    sourceId: "source23",
                    data: ["text", { startIdx: 112, endIdx: 166 }],
                  },
                },
              ],
              similarClaimIds: ["claim26", "claim27"],
            },
            {
              id: "claim26",
              title: "Claim 26",
              quotes: [
                {
                  id: "quote52",
                  text: "Consequat interdum varius sit amet mattis vulputate enim nulla",
                  reference: {
                    id: "ref52",
                    sourceId: "source24",
                    data: ["text", { startIdx: 0, endIdx: 60 }],
                  },
                },
                {
                  id: "quote53",
                  text: "Aliquet porttitor lacus luctus accumsan tortor",
                  reference: {
                    id: "ref53",
                    sourceId: "source24",
                    data: ["text", { startIdx: 61, endIdx: 105 }],
                  },
                },
              ],
              similarClaimIds: ["claim25", "claim27"],
            },
            {
              id: "claim27",
              title: "Claim 27",
              quotes: [
                {
                  id: "quote54",
                  text: "Posuere ac ut consequat semper viverra nam libero justo laoreet",
                  reference: {
                    id: "ref54",
                    sourceId: "source25",
                    data: ["text", { startIdx: 0, endIdx: 61 }],
                  },
                },
                {
                  id: "quote55",
                  text: "Sit amet cursus sit amet dictum sit amet justo donec enim",
                  reference: {
                    id: "ref55",
                    sourceId: "source25",
                    data: ["text", { startIdx: 62, endIdx: 117 }],
                  },
                },
              ],
              similarClaimIds: ["claim25", "claim26"],
            },
          ],
        },
      ],
    },
    {
      id: "theme5",
      title: "Theme 5",
      description: "Pretium vulputate sapien nec sagittis aliquam",
      topics: [
        {
          id: "topic9",
          title: "Topic 9",
          description: "Malesuada bibendum arcu vitae elementum",
          claims: [
            {
              id: "claim28",
              title: "Claim 28",
              quotes: [
                {
                  id: "quote56",
                  text: "Curabitur vitae nunc sed velit dignissim sodales ut eu sem",
                  reference: {
                    id: "ref56",
                    sourceId: "source26",
                    data: ["text", { startIdx: 0, endIdx: 57 }],
                  },
                },
                {
                  id: "quote57",
                  text: "Integer vitae justo eget magna fermentum iaculis eu non diam",
                  reference: {
                    id: "ref57",
                    sourceId: "source26",
                    data: ["text", { startIdx: 58, endIdx: 116 }],
                  },
                },
              ],
              similarClaimIds: ["claim29"],
            },
            {
              id: "claim29",
              title: "Claim 29",
              quotes: [
                {
                  id: "quote58",
                  text: "Phasellus vestibulum lorem sed risus ultricies tristique nulla",
                  reference: {
                    id: "ref58",
                    sourceId: "source27",
                    data: ["text", { startIdx: 0, endIdx: 60 }],
                  },
                },
                {
                  id: "quote59",
                  text: "Aliquet enim tortor at auctor urna nunc id cursus metus",
                  reference: {
                    id: "ref59",
                    sourceId: "source27",
                    data: ["text", { startIdx: 61, endIdx: 114 }],
                  },
                },
                {
                  id: "quote60",
                  text: "Aliquam vestibulum morbi blandit cursus risus at ultrices mi",
                  reference: {
                    id: "ref60",
                    sourceId: "source27",
                    data: ["text", { startIdx: 115, endIdx: 172 }],
                  },
                },
              ],
              similarClaimIds: ["claim28"],
            },
          ],
        },
        {
          id: "topic10",
          title: "Topic 10",
          description: "Curabitur gravida arcu ac tortor dignissim",
          claims: [
            {
              id: "claim30",
              title: "Claim 30",
              quotes: [
                {
                  id: "quote61",
                  text: "Convallis tellus id interdum velit laoreet id donec ultrices",
                  reference: {
                    id: "ref61",
                    sourceId: "source28",
                    data: ["text", { startIdx: 0, endIdx: 59 }],
                  },
                },
                {
                  id: "quote62",
                  text: "Tincidunt tortor aliquam nulla facilisi cras fermentum odio eu",
                  reference: {
                    id: "ref62",
                    sourceId: "source28",
                    data: ["text", { startIdx: 60, endIdx: 118 }],
                  },
                },
              ],
              similarClaimIds: ["claim31"],
            },
            {
              id: "claim31",
              title: "Claim 31",
              quotes: [
                {
                  id: "quote63",
                  text: "Feugiat pretium nibh ipsum consequat nisl vel pretium lectus",
                  reference: {
                    id: "ref63",
                    sourceId: "source29",
                    data: ["text", { startIdx: 0, endIdx: 58 }],
                  },
                },
                {
                  id: "quote64",
                  text: "Quam vulputate dignissim suspendisse in est ante in nibh mauris",
                  reference: {
                    id: "ref64",
                    sourceId: "source29",
                    data: ["text", { startIdx: 59, endIdx: 119 }],
                  },
                },
              ],
              similarClaimIds: ["claim30"],
            },
          ],
        },
      ],
    },
  ],
  sources: [
    {
      id: "source1",
      data: [
        "text",
        {
          text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
        },
      ],
    },
    {
      id: "source2",
      data: [
        "text",
        {
          text: "Quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
        },
      ],
    },
    {
      id: "source3",
      data: [
        "text",
        {
          text: "Duis aute irure dolor in reprehenderit in voluptate velit esse cillumdolore eu fugiat nulla pariatur.",
        },
      ],
    },
    {
      id: "source4",
      data: [
        "text",
        {
          text: "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
        },
      ],
    },
    {
      id: "source5",
      data: [
        "text",
        {
          text: "Laoreet sit amet cursus sit amet dictum sit amet justo donec enim diam vulputate ut pharetra sit amet aliquam.",
        },
      ],
    },
    {
      id: "source6",
      data: [
        "text",
        {
          text: "Ut tristique et egestas quis ipsum suspendisse ultrices gravida dictum fusce ut placerat orci nulla pellentesque dignissim enim sit.",
        },
      ],
    },
    {
      id: "source7",
      data: [
        "text",
        {
          text: "Amet nulla facilisi morbi tempus iaculis urna id faucibus nisl tincidunt eget nullam non nisi est sit amet facilisis magna etiam tempor.",
        },
      ],
    },
    {
      id: "source8",
      data: [
        "text",
        {
          text: "Vitae tempus quam pellentesque nec nam aliquam sem et tortor at risus viverra adipiscing at in tellus integer feugiat scelerisque varius morbi enim nunc.",
        },
      ],
    },
    {
      id: "source9",
      data: [
        "text",
        {
          text: "Faucibus purus in massa tempor nec feugiat nisl pretium fusce ut placerat orci nulla pellentesque dignissim.",
        },
      ],
    },
    {
      id: "source10",
      data: [
        "text",
        {
          text: "Enim sit amet venenatis urna cursus eget nunc scelerisque viverra mauris.",
        },
      ],
    },
    {
      id: "source11",
      data: [
        "text",
        {
          text: "Sapien nec sagittis aliquam malesuada bibendum arcu vitae elementum curabitur vitae nunc sed velit dignissim.",
        },
      ],
    },
    {
      id: "source12",
      data: [
        "text",
        {
          text: "Sodales ut eu sem integer vitae justo eget magna fermentum iaculis eu non diam phasellus vestibulum rhoncus est pellentesque elit ullamcorper.",
        },
      ],
    },
    {
      id: "source13",
      data: [
        "text",
        {
          text: "Dignissim cras tincidunt lobortis feugiat vivamus at augue eget arcu dictum varius duis at consectetur lorem.",
        },
      ],
    },
    {
      id: "source14",
      data: [
        "text",
        {
          text: "Ac turpis egestas maecenas pharetra convallis posuere morbi non arcu risus quis varius quam quisque.",
        },
      ],
    },
    {
      id: "source15",
      data: [
        "text",
        {
          text: "Id aliquam etiam erat velit scelerisque in dictum non consectetur nisi erat adipiscing elit proin risus praesent lectus vestibulum ante ipsum primis in faucibus orci luctus.",
        },
      ],
    },
    {
      id: "source16",
      data: [
        "text",
        {
          text: "Tincidunt eget nullam non nisi est sit amet facilisis magna etiam tempor.",
        },
      ],
    },
    {
      id: "source17",
      data: [
        "text",
        {
          text: "Blandit cursus risus at ultrices mi tempus imperdiet nulla malesuada proin libero nunc consequat interdum varius sit.",
        },
      ],
    },
    {
      id: "source18",
      data: [
        "text",
        {
          text: "Amet mattis vulputate enim nulla aliquet porttitor lacus luctus accumsan tortor posuere ac ut consequat semper viverra nam libero justo laoreet sit amet cursus sit amet.",
        },
      ],
    },
    {
      id: "source19",
      data: [
        "text",
        {
          text: "Dictum sit amet justo donec enim diam vulputate ut pharetra sit amet aliquam.",
        },
      ],
    },
    {
      id: "source20",
      data: [
        "text",
        {
          text: "Sed faucibus turpis in eu mi bibendum neque egestas congue quisque egestas diam in arcu cursus euismod quis.",
        },
      ],
    },
    {
      id: "source21",
      data: [
        "text",
        {
          text: "Viverra nam libero justo laoreet sit amet cursus sit amet dictum sit amet justo donec enim diam vulputate ut.",
        },
      ],
    },
    {
      id: "source22",
      data: [
        "text",
        {
          text: "In massa tempor nec feugiat nisl pretium fusce id velit ut tortor pretium viverra suspendisse potenti nullam ac tortor vitae semper quis lectus nulla at volutpat diam ut venenatis.",
        },
      ],
    },
    {
      id: "source23",
      data: [
        "text",
        {
          text: "Tellus molestie nunc non blandit massa enim nec dui nunc mattis rhoncus urna neque viverra justo nec ultrices dui sapien et ligula ullamcorper malesuada proin libero nunc.",
        },
      ],
    },
    {
      id: "source24",
      data: [
        "text",
        {
          text: "Consequat interdum varius sit amet mattis vulputate enim nulla aliquet porttitor lacus luctus accumsan tortor.",
        },
      ],
    },
    {
      id: "source25",
      data: [
        "text",
        {
          text: "Posuere ac ut consequat semper viverra nam libero justo laoreet sit amet cursus sit amet dictum sit amet justo donec enim.",
        },
      ],
    },
    {
      id: "source26",
      data: [
        "text",
        {
          text: "Curabitur vitae nunc sed velit dignissim sodales ut eu sem integer vitae justo eget magna fermentum iaculis eu non diam.",
        },
      ],
    },
    {
      id: "source27",
      data: [
        "text",
        {
          text: "Phasellus vestibulum lorem sed risus ultricies tristique nulla aliquet enim tortor at auctor urna nunc id cursus metus aliquam vestibulum morbi blandit cursus risus at ultrices mi.",
        },
      ],
    },
    {
      id: "source28",
      data: [
        "text",
        {
          text: "Convallis tellus id interdum velit laoreet id donec ultrices tincidunt tortor aliquam nulla facilisi cras fermentum odio eu.",
        },
      ],
    },
    {
      id: "source29",
      data: [
        "text",
        {
          text: "Feugiat pretium nibh ipsum consequat nisl vel pretium lectus quam vulputate dignissim suspendisse in est ante in nibh mauris.",
        },
      ],
    },
  ],
  graphics: [
    "piechart",
    {
      title: "Sample Pie Chart",
      items: [
        { label: "Item 1", count: 25 },
        { label: "Item 2", count: 50 },
        { label: "Item 3", count: 75 },
      ],
    },
  ],
  date: "2023-06-05",
};
