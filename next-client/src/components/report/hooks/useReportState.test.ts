import { beforeAll, describe, expect, test } from "vitest";
import {
  __internals,
  ReportState,
  SomeNode,
  TopicNode,
} from "./useReportState";
import { reportData } from "stories/data/dummyData";
import { Array, Effect, Option, pipe } from "effect";

const {
  //   combineActions,
  //   mapActions,
  //   replaceNode,
  //   findTopic,
  //   changeTopic,
  //   mapTopic,
  //   openTopic,
  //   closeTopic,
  //   toggleTopic,
  //   openAllTopics,
  //   closeAllTopics,
  //   resetAllTopics,
  //   expandTopic,
  //   resetTopic,
  //   findSubtopicInTopic,
  //   findSubtopic,
  //   parentOfSubtopic,
  //   changeSubtopic,
  //   mapSubtopic,
  //   expandSubtopic,
  //   resetSubtopic,
  //   resetAllSubtopics,
  reducer,
  stateBuilder,
  //   undefinedCheck,
  //   mapTopicChildren,
  //   resetTopicsChildren,
  defaultTopicPagination,
  defaultSubtopicPagination,
  //   addTopicPagination,
  //   addSubtopicPagination,
  findNodePath,
} = __internals;

const state = stateBuilder(reportData.topics);

// Gets a topic at a specific index
const getTopic = (state: ReportState, idx: number = 0) => state.children[idx];

const getMiddleTopic = (state: ReportState) =>
  getTopic(state, Math.floor(state.children.length / 2));

// Gets the last topic
const getLastTopic = (state: ReportState) =>
  getTopic(state, state.children.length - 1);

// gets a subtopic from a topic idx and subtopicidx
const getSubtopic = (
  state: ReportState,
  topicIdx: number = 0,
  subtopicIdx: number = 0,
) => getTopic(state, topicIdx).children[subtopicIdx];

// gets the very last subtopic in the last topic
const getLastSubtopic = (state: ReportState) =>
  getLastTopic(state).children[getLastTopic(state).children.length - 1];

// get a node's id
const getId = (node: SomeNode) => node.data.id;

beforeAll(() => {
  if (state.children.length < 3) {
    throw new Error(
      "Get a larger test dataset for useReportState. Num of topics is below 3",
    );
  }
});

describe("Test Tools", () => {
  test("getTopic", () => {
    expect(getTopic(state).data.title).toBe("Medical AI");
  });

  test("getLastTopic", () => {
    expect(getLastTopic(state).data.title).toBe(
      "Future Prospects and Challenges",
    );
  });

  test("getMiddleTopic", () => {
    expect(getMiddleTopic(state).data.title).toBe("Technology and Challenges");
  });

  test("getSubtopic", () => {
    expect(getSubtopic(state).data.title).toBe("Medical AI applications");
  });

  test("getLastSubtopic", () => {
    expect(getLastSubtopic(state).data.title).toBe("Activities and Feedback");
  });
});

// const identity = <T>(arg: T): T => arg;

// //  ********************************
// //  * Builder Functions *
// //  ********************************/

describe("Builder", () => {
  describe("Expected Topics", () => {
    test("Expected initial state", () => {
      expect(
        state.children.every((topicNode) => {
          return (
            !topicNode.isOpen && topicNode.pagination === defaultTopicPagination
          );
        }),
      ).true;
    });
  });

  describe.skip("Expected Topics", () => {
    test("Expected initial state", () => {
      expect(
        state.children
          .flatMap((topic) => topic.children)
          .every(
            (subtopic) => subtopic.pagination === defaultSubtopicPagination,
          ),
      ).true;
    });
  });
});

//  ********************************
//  * Reducer Functions *
//  ********************************/
describe("Reducer Functions", () => {
  const firstTopic = getTopic(state);
  const lastTopic = getLastTopic(state);
  const middleTopic = getMiddleTopic(state);
  const testTopics = [firstTopic, middleTopic, lastTopic];
  const open = (reportState: ReportState, id: string) =>
    reducer(reportState, { type: "open", payload: { id } });

  describe("Open", () => {
    const [first, middle, last] = testTopics.map((t) => open(state, getId(t)));
    describe("Opens a closed topic", () => {
      // does the first topic open
      test("Opens first topic", () => {
        expect(getTopic(first).isOpen).true;
      });
      // does the middle topic open
      test("Opens middle topic", () => {
        expect(getMiddleTopic(middle).isOpen).true;
      });
      // does the last topic open
      test("Opens last topic", () => {
        expect(getLastTopic(last).isOpen).true;
      });
    });

    test("Opened node is the only opened node", () => {
      expect(
        [first, middle, last]
          .map((rs) => rs.children.filter((t) => t.isOpen).length)
          .every((n) => n === 1),
      ).true;
    });

    test("Opening another node doesn't affect original", () => {
      const withSecondOpened = [first, middle, last].map((s) =>
        open(s, getId(getTopic(s, 1))),
      );

      expect(
        withSecondOpened
          .map((s) => s.children.filter((t) => t.isOpen).length)
          .every((n) => n == 2),
      ).true;
    });

    test("Open is idempotent", () => {
      const firstAgain = open(first, getId(firstTopic));
      const middleAgain = open(middle, getId(middleTopic));
      const lastAgain = open(last, getId(lastTopic));

      expect(
        [firstAgain, middleAgain, lastAgain]
          .map((s) => s.children.filter((t) => t.isOpen).length)
          .every((n) => n == 1),
      ).true;
    });
  });
});

describe("Utility functions", () => {
  describe("findNodePath", () => {
    const testFindNodePath = (node: SomeNode) =>
      Option.getOrNull(findNodePath(state, getId(node)));

    test("Finds first topic", () => {
      expect(testFindNodePath(getTopic(state))).toStrictEqual([0]);
    });

    test("Finds middle topic", () => {
      expect(testFindNodePath(getMiddleTopic(state))).toStrictEqual([
        Math.floor(state.children.length / 2),
      ]);
    });

    test("Finds last topic", () => {
      expect(testFindNodePath(getLastTopic(state))).toStrictEqual([
        state.children.length - 1,
      ]);
    });

    test("Finds subtopic in first topic", () => {
      expect(testFindNodePath(getSubtopic(state))).toStrictEqual([0, 0]);
    });

    test("Finds last subtopic", () => {
      expect(testFindNodePath(getLastSubtopic(state))).toStrictEqual([
        state.children.length - 1,
        state.children[state.children.length - 1].children.length - 1,
      ]);
    });

    test("Finds claim", () => {
      expect(testFindNodePath(getSubtopic(state).children[0])).toStrictEqual([
        0, 0, 0,
      ]);
    });

    test("Returns Option.none when it couldn't find the node", () => {
      expect(Option.isNone(findNodePath(state, "This should not be found")))
        .true;
    });
  });
});

// //  ********************************
// //  * Higher Order Functions *
// //  ********************************/
// describe("HOF", () => {
//   describe("combineActions", () => {
//     const combined = combineActions(openTopic, expandTopic);
//     const id = getTopic(state).data.id;
//     const intermediateState = openTopic(state, id);
//     const finalState = expandTopic(intermediateState, id);
//     test("Combined function is equivalent to two seperate applications", () => {
//       const combinedState = combined(state, id);
//       expect(combinedState).toStrictEqual(finalState);
//     });

//     test("Order independence (for different changes)", () => {
//       const combined2 = combineActions(expandTopic, openTopic);
//       const newState = combined2(state, id);
//       expect(newState).toStrictEqual(finalState);
//     });
//   });

//   describe("mapActions", () => {
//     test("Identity changes nothing", () => {
//       const applyId = mapActions(identity, identity);
//       const sameState = applyId(state);
//       expect(sameState).toStrictEqual(state);
//     });

//     test("Function is applied to everything", () => {
//       const func = mapActions(identity, openAllTopics);
//       const newState = func(state);
//       expect(newState.children.every((node) => node.isOpen)).true;
//     });
//   });
// });

// //  ********************************
// //  * Utility Functions *
// //  ********************************/

// describe("Utility Functions", () => {
//   describe("undefinedCheck", () => {
//     test("Returns arg on arg !== undefined", () => {
//       expect(undefinedCheck(1)).toBe(1);
//       expect(undefinedCheck("test")).toBe("test");
//       expect(undefinedCheck(null)).toBe(null);
//       expect(undefinedCheck([])).toStrictEqual([]);
//       expect(undefinedCheck(0)).toBe(0);
//     });

//     test("Throw on undefined", () => {
//       expect(() => undefinedCheck(undefined)).toThrowError();
//     });
//   });

//   describe("replaceNode", () => {
//     const newTopic1: TopicNode = {
//       ...getTopic(state),
//       isOpen: true,
//       pagination: 42,
//     };
//     const newChildren1: TopicNode[] = replaceNode(state.children, newTopic1);

//     const newTopic2 = {
//       ...getLastTopic(state),
//       isOpen: true,
//       pagination: 9001,
//     };
//     const newChildren2: TopicNode[] = replaceNode(state.children, newTopic2);

//     test("Node is replace", () => {
//       expect(newChildren1[0]).toStrictEqual(newTopic1);
//       expect(newChildren2[newChildren2.length - 1]).toStrictEqual(newTopic2);
//     });

//     test("Maintains sames length", () => {
//       expect(newChildren1.length).toBe(state.children.length);
//       expect(newChildren2.length).toBe(state.children.length);
//     });
//   });
// });

// //  ********************************
// //  * Topic *
// //  ********************************/
// describe("Topic", () => {
//   describe("Base Functions", () => {
//     describe("findTopic", () => {
//       test("Finds existing topic", () => {
//         expect(findTopic(state, getTopic(state).data.id)).toStrictEqual(
//           getTopic(state),
//         );
//         expect(findTopic(state, getLastTopic(state).data.id)).toStrictEqual(
//           getLastTopic(state),
//         );
//       });

//       test("Thows an error if mismatched id", () => {
//         expect(() => findTopic(state, "doesn't exist")).toThrowError();
//       });
//     });
//   });

//   describe("Applicative Functions", () => {
//     describe("changeTopic", () => {
//       test("Identity won't change anything", () => {
//         const applyId = changeTopic(identity);
//         const sameState1 = applyId(state, getTopic(state).data.id);
//         expect(sameState1).toStrictEqual(state);
//         const sameState2 = applyId(state, getLastTopic(state).data.id);
//         expect(sameState2).toStrictEqual(state);
//       });

//       test("Only changes node with provided id", () => {
//         const openedState1 = changeTopic((node) => ({ ...node, isOpen: true }))(
//           state,
//           getTopic(state).data.id,
//         );
//         const openedState2 = changeTopic((node) => ({ ...node, isOpen: true }))(
//           state,
//           getLastTopic(state).data.id,
//         );
//         expect(openedState1.children.slice(1).every((node) => !node.isOpen));
//         expect(
//           openedState2.children
//             .slice(0, openedState2.children.length - 2)
//             .every((node) => !node.isOpen),
//         );
//       });
//     });

//     describe("mapTopic", () => {
//       const setPage0 = mapTopic((node) => ({ ...node, pagination: 0 }));
//       const applyId = mapTopic(identity);

//       test("Identity won't change anything", () => {
//         const sameState = applyId(state);
//         expect(sameState).toStrictEqual(state);
//       });

//       test("Applies to all topics", () => {
//         const newState = setPage0(state);
//         expect(newState.children.every((node) => node.pagination === 0)).true;
//       });

//       test("Doesn't apply to children", () => {
//         const newState = setPage0(state);
//         expect(
//           newState.children
//             .flatMap((topic) => topic.children)
//             .every((subtopic) => subtopic.pagination !== 0),
//         );
//       });
//     });
//   });

//   describe("Tranformers", () => {
//     describe("openTopic", () => {
//       const openedState1 = openTopic(state, getTopic(state).data.id);
//       const openedState2 = openTopic(state, getLastTopic(state).data.id);

//       test("Changed state", () => {
//         expect(openedState1).not.toStrictEqual(state);
//         expect(openedState2).not.toStrictEqual(state);
//         expect(getTopic(openedState1).isOpen).true;
//         expect(getLastTopic(openedState2).isOpen);
//       });
//     });

//     describe("closeTopic", () => {
//       const id = getTopic(state).data.id;
//       const openedState = openTopic(state, id);

//       test("Can close topic", () => {
//         const closedState = closeTopic(openedState, id);
//         expect(closedState).toStrictEqual(state);
//       });
//     });

//     describe("toggleTopic", () => {
//       const id = getTopic(state).data.id;
//       const openedState = toggleTopic(state, id);
//       const doesNothing = combineActions(toggleTopic, toggleTopic);

//       test("toggle once to open", () => {
//         expect(getTopic(openedState).isOpen).true;
//       });

//       test("toggle twice goes back to original pos", () => {
//         expect(doesNothing(state, id)).toStrictEqual(state);
//       });
//     });

//     describe("openAll", () => {
//       test("opens all topics", () => {
//         expect(openAllTopics(state).children.every((val) => val.isOpen)).true;
//       });
//     });

//     describe("closeAll", () => {
//       test("closes all topics", () => {
//         expect(mapActions(openAllTopics, closeAllTopics)(state)).toStrictEqual(
//           state,
//         );
//       });
//     });

//     describe("expandTopic", () => {
//       const id = getTopic(state).data.id;
//       const expandedState = expandTopic(state, id);
//       test("Expanding topic increases pagination", () => {
//         expect(getTopic(expandedState).pagination).greaterThan(
//           getTopic(state).pagination,
//         );
//       });
//     });

//     describe("resetTopic", () => {
//       const id = getTopic(state).data.id;
//       const func = combineActions(expandTopic, resetTopic);
//       test("Resetting topic brings it back to original", () => {
//         expect(func(state, id)).toStrictEqual(state);
//       });
//     });
//   });
// });

// //  ********************************
// //  * Subtopic *
// //  ********************************/
// describe("Subtopic", () => {
//   describe("Base Functions", () => {
//     describe("findSubtopic", () => {
//       const subtopic1 = getSubtopic(state);
//       const subtopic2 = getLastSubtopic(state);

//       test("Should find topic in reportState", () => {
//         expect(findSubtopic(state, subtopic1.data.id)).toStrictEqual(subtopic1);
//         expect(findSubtopic(state, subtopic2.data.id)).toStrictEqual(subtopic2);
//       });

//       test("Should throw an error if it doesn't exist", () => {
//         expect(() => findSubtopic(state, "")).toThrowError();
//       });
//     });

//     describe("findParent", () => {
//       const firstsubtopicId = getSubtopic(state).data.id;
//       const lastsubtopicId = getLastSubtopic(state).data.id;
//       // const topic = parentOfSubtopic(state.children, firstsubtopicId);
//       test("Expects to find parent of subtopicId", () => {
//         expect(parentOfSubtopic(state.children, firstsubtopicId)).toStrictEqual(
//           getTopic(state),
//         );
//         expect(parentOfSubtopic(state.children, lastsubtopicId)).toStrictEqual(
//           getLastTopic(state),
//         );
//       });
//     });
//   });

//   describe("Applicative Functions", () => {
//     const subtopicId = getLastSubtopic(state).data.id;
//     const applyId = changeSubtopic(identity);

//     describe("changeSubtopic", () => {
//       test("Identity should not affect anything", () => {
//         expect(applyId(state, subtopicId)).toStrictEqual(state);
//         expect(true).true;
//       });

//       test("Provided transformer should change topic", () => {
//         const newState = changeSubtopic((subtopic) => ({
//           ...subtopic,
//           pagination: 9001,
//         }))(state, subtopicId);
//         expect(getLastSubtopic(newState).pagination).toBe(9001);
//       });
//     });

//     describe("mapSubtopic", () => {
//       const applyId = mapSubtopic(identity);
//       const func = mapSubtopic((subtopic) => ({
//         ...subtopic,
//         pagination: 9001,
//       }));

//       test("Identity should not affect anything", () => {
//         expect(applyId(state)).toStrictEqual(state);
//       });

//       test("Transform should apply to every topic", () => {
//         const newState = func(state);
//         expect(
//           newState.children
//             .flatMap((node) => node.children)
//             .every((subtopic) => subtopic.pagination === 9001),
//         ).true;
//       });
//     });

//     describe("mapTopicChildren", () => {
//       const topicId = getLastTopic(state).data.id;
//       const newState = mapTopicChildren((subtopic) => ({
//         ...subtopic,
//         pagination: 9001,
//       }))(state, topicId);

//       test("Should apply to children of correct topic", () => {
//         expect(
//           getLastTopic(newState).children.every(
//             (node) => node.pagination === 9001,
//           ),
//         );
//       });

//       test("Should only apply to children of correct topic", () => {
//         const otherPagNums = newState.children
//           .filter((node) => node.data.id !== topicId)
//           .flatMap((node) => node.children)
//           .map((subtopic) => subtopic.pagination);

//         const uniques = Array.from(new Set(otherPagNums));

//         expect(uniques).length(1);
//         expect(uniques[0]).toBe(defaultSubtopicPagination);
//       });
//     });
//   });

//   describe("Transformers", () => {
//     const subtopic = getSubtopic(state);
//     const subtopicId = subtopic.data.id;

//     describe("expandSubtopic", () => {
//       const newState = expandSubtopic(state, subtopicId);

//       test("Should increase the topic's pagination", () => {
//         expect(getSubtopic(newState).pagination).greaterThan(
//           getSubtopic(state).pagination,
//         );
//       });
//     });

//     describe("resetSubtopic", () => {
//       const newState = combineActions(expandSubtopic, resetSubtopic)(
//         state,
//         subtopicId,
//       );

//       test("Resetting topic should bring it back to the default", () => {
//         expect(newState).toStrictEqual(state);
//       });
//     });

//     describe("resetTopicTopics", () => {
//       const topicId = getTopic(state).data.id;
//       const setupState = mapTopicChildren((subtopic) => ({
//         ...subtopic,
//         pagination: 9001,
//       }));
//       const newState = combineActions(setupState, resetTopicsChildren)(
//         state,
//         topicId,
//       );
//       test("Restting topic's topics brings it back to default", () => {
//         expect(newState).toStrictEqual(state);
//       });
//     });

//     describe("resetAllSubtopics", () => {
//       const setAllTopics = mapSubtopic((subtopic) => ({
//         ...subtopic,
//         pagination: 9001,
//       }));
//       const newState = mapActions(setAllTopics, resetAllSubtopics)(state);
//       test("Resetting all subtopics should bring them back to the default", () => {
//         expect(newState).toStrictEqual(state);
//       });
//     });
//   });
// });

// //  ********************************
// //  * Actions *
// //  ********************************/
// describe("Actions", () => {
//   describe("open", () => {
//     const openAction = (state: ReportState, id: string) =>
//       reducer(state, { type: "open", payload: { id } });
//     const id = getTopic(state).data.id;
//     const lastId = getLastTopic(state).data.id;

//     describe("Opening topic", () => {
//       test("Opening with topicId sets topic to open", () => {
//         const newState1 = openAction(state, id);
//         expect(getTopic(newState1).isOpen).true;

//         const newState2 = openAction(state, lastId);
//         expect(getLastTopic(newState2).isOpen).true;
//       });
//     });

//     describe("Opening topic", () => {
//       const firstsubtopicId = getSubtopic(state).data.id;
//       const lastsubtopicId = getLastSubtopic(state).data.id;
//       const firstState = openAction(state, firstsubtopicId);
//       const lastState = openAction(state, lastsubtopicId);
//       test("Opening with subtopicId should set parent topic to open", () => {
//         expect(getTopic(firstState).isOpen).true;
//         expect(getLastTopic(lastState).isOpen).true;
//       });

//       // ! Skip this for now - default pagination is now set to higher than whats in the test data. Get new data for this to work.
//       describe.skip("Opening with subtopicId should set pagination to correct value", () => {
//         test("Topic is earlier than pagination", () => {
//           expect(getTopic(firstState).pagination === defaultTopicPagination);
//         });

//         test("Topic is later than pagination", () => {
//           const deepsubtopicId = getTopic(state).children[
//             getTopic(state).children.length - 1
//           ].data.id as string;
//           const deepState = openAction(state, deepsubtopicId);
//           expect(getTopic(deepState).pagination).greaterThan(
//             defaultTopicPagination,
//           );
//         });
//       });
//     });
//   });

//   describe("close", () => {
//     const close = (state: ReportState, id: string) =>
//       reducer(state, { type: "close", payload: { id } });
//     const topicId = getTopic(state).data.id;
//     const subtopicId = getSubtopic(state).data.id;
//     const setupTopic = combineActions(openTopic, expandTopic);

//     const _setupState = setupTopic(state, topicId);
//     const setupState = expandSubtopic(_setupState, subtopicId);

//     const newState = close(setupState, topicId);

//     test("Close should reset isOpen, pagination, and children pagination", () => {
//       expect(newState).toStrictEqual(state);
//     });
//   });

//   describe("openAll", () => {
//     const openAllAction = (state: ReportState) =>
//       reducer(state, { type: "openAll", payload: { id: "" } });
//     const newState = openAllAction(state);
//     test("Should set every topic to open", () => {
//       expect(newState.children.every((node) => node.isOpen)).true;
//     });
//   });

//   describe("closeAll", () => {
//     const closeAllAction = (state: ReportState) =>
//       reducer(state, { type: "closeAll", payload: { id: "" } });
//     const setupFunc = mapActions(
//       openAllTopics,
//       mapTopic((node) => ({ ...node, pagination: 9001 })),
//       mapSubtopic((node) => ({ ...node, pagination: 42 })),
//     );
//     const setupState = setupFunc(state);

//     test("Opening and then closing does nothing", () => {
//       expect(mapActions(openAllTopics, closeAllAction));
//     });

//     test("Closing all should close, reset topics and topics", () => {
//       expect(closeAllAction(setupState)).toStrictEqual(state);
//     });
//   });

//   describe("expandTopic", () => {
//     const expandTopicAction = (state: ReportState, id: string) =>
//       reducer(state, { type: "expandTopic", payload: { id } });
//     const topicId = getTopic(state).data.id;
//     test("Expanding topic should increase pagination by some const", () => {
//       const newState = expandTopicAction(state, topicId);
//       expect(getTopic(newState).pagination).toBe(
//         getTopic(state).pagination + addTopicPagination,
//       );
//     });
//   });

//   describe("expandSubtopic", () => {
//     const expandSubtopicAction = (state: ReportState, id: string) =>
//       reducer(state, { type: "expandSubtopic", payload: { id } });
//     const subtopicId = getSubtopic(state).data.id;
//     test("Expanding subtopic should increase pagination by some const", () => {
//       const newState = expandSubtopicAction(state, subtopicId);
//       expect(getSubtopic(newState).pagination).toBe(
//         getSubtopic(state).pagination + addSubtopicPagination,
//       );
//     });
//   });
// });
