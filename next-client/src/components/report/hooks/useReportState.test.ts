import { describe, expect, test } from "vitest";
import { __internals, ReportState, ThemeNode } from "./useReportState";
import { reportData } from "stories/data/dummyData";

const {
  combineActions,
  mapActions,
  replaceNode,
  findTheme,
  changeTheme,
  mapTheme,
  openTheme,
  closeTheme,
  toggleTheme,
  openAllThemes,
  closeAllThemes,
  resetAllThemes,
  expandTheme,
  resetTheme,
  findTopicInTheme,
  findTopic,
  parentOfTopic,
  changeTopic,
  mapTopic,
  expandTopic,
  resetTopic,
  resetAllTopics,
  reducer,
  stateBuilder,
  undefinedCheck,
  mapThemeChildren,
  resetThemesTopics,
  defaultThemePagination,
  defaultTopicPagination,
  addThemePagination,
  addTopicPagination,
} = __internals;

const state = stateBuilder(reportData.themes);
const getTheme = (state: ReportState, idx: number = 0) => state.children[idx];
const getLastTheme = (state: ReportState) =>
  getTheme(state, state.children.length - 1);
const getTopic = (
  state: ReportState,
  themeIdx: number = 0,
  topicIdx: number = 0,
) => getTheme(state, themeIdx).children[topicIdx];
const getLastTopic = (state: ReportState) =>
  getLastTheme(state).children[getLastTheme(state).children.length - 1];

describe("Test Tools", () => {
  test("getTheme", () => {
    expect(getTheme(state).data.title).toBe("Technology in Peace-Building");
  });

  test("getLastTheme", () => {
    expect(getLastTheme(state).data.title).toBe("Access and Inclusion");
  });

  test("getTopic", () => {
    expect(getTopic(state).data.title).toBe("Technical Skill Development");
  });

  test("getLastTopic", () => {
    expect(getLastTopic(state).data.title).toBe("Representative Data");
  });
});

const identity = <T>(arg: T): T => arg;

//  ********************************
//  * Builder Functions *
//  ********************************/

describe("Builder", () => {
  describe("Expected Themes", () => {
    test("Expected initial state", () => {
      expect(
        state.children.every((themeNode) => {
          return (
            !themeNode.isOpen && themeNode.pagination === defaultThemePagination
          );
        }),
      ).true;
    });
  });

  describe("Expected Topics", () => {
    test("Expected initial state", () => {
      expect(
        state.children
          .flatMap((theme) => theme.children)
          .every((topic) => topic.pagination === defaultTopicPagination),
      ).true;
    });
  });
});

//  ********************************
//  * Higher Order Functions *
//  ********************************/
describe("HOF", () => {
  describe("combineActions", () => {
    const combined = combineActions(openTheme, expandTheme);
    const id = getTheme(state).data.id;
    const intermediateState = openTheme(state, id);
    const finalState = expandTheme(intermediateState, id);
    test("Combined function is equivalent to two seperate applications", () => {
      const combinedState = combined(state, id);
      expect(combinedState).toStrictEqual(finalState);
    });

    test("Order independence (for different changes)", () => {
      const combined2 = combineActions(expandTheme, openTheme);
      const newState = combined2(state, id);
      expect(newState).toStrictEqual(finalState);
    });
  });

  describe("mapActions", () => {
    test("Identity changes nothing", () => {
      const applyId = mapActions(identity, identity);
      const sameState = applyId(state);
      expect(sameState).toStrictEqual(state);
    });

    test("Function is applied to everything", () => {
      const func = mapActions(identity, openAllThemes);
      const newState = func(state);
      expect(newState.children.every((node) => node.isOpen)).true;
    });
  });
});

//  ********************************
//  * Utility Functions *
//  ********************************/

describe("Utility Functions", () => {
  describe("undefinedCheck", () => {
    test("Returns arg on arg !== undefined", () => {
      expect(undefinedCheck(1)).toBe(1);
      expect(undefinedCheck("test")).toBe("test");
      expect(undefinedCheck(null)).toBe(null);
      expect(undefinedCheck([])).toStrictEqual([]);
      expect(undefinedCheck(0)).toBe(0);
    });

    test("Throw on undefined", () => {
      expect(() => undefinedCheck(undefined)).toThrowError();
    });
  });

  describe("replaceNode", () => {
    const newTheme1: ThemeNode = {
      ...getTheme(state),
      isOpen: true,
      pagination: 42,
    };
    const newChildren1: ThemeNode[] = replaceNode(state.children, newTheme1);

    const newTheme2 = {
      ...getLastTheme(state),
      isOpen: true,
      pagination: 9001,
    };
    const newChildren2: ThemeNode[] = replaceNode(state.children, newTheme2);

    test("Node is replace", () => {
      expect(newChildren1[0]).toStrictEqual(newTheme1);
      expect(newChildren2[newChildren2.length - 1]).toStrictEqual(newTheme2);
    });

    test("Maintains sames length", () => {
      expect(newChildren1.length).toBe(state.children.length);
      expect(newChildren2.length).toBe(state.children.length);
    });
  });
});

//  ********************************
//  * Theme *
//  ********************************/
describe("Theme", () => {
  describe("Base Functions", () => {
    describe("findTheme", () => {
      test("Finds existing theme", () => {
        expect(findTheme(state, getTheme(state).data.id)).toStrictEqual(
          getTheme(state),
        );
        expect(findTheme(state, getLastTheme(state).data.id)).toStrictEqual(
          getLastTheme(state),
        );
      });

      test("Thows an error if mismatched id", () => {
        expect(() => findTheme(state, "doesn't exist")).toThrowError();
      });
    });
  });

  describe("Applicative Functions", () => {
    describe("changeTheme", () => {
      test("Identity won't change anything", () => {
        const applyId = changeTheme(identity);
        const sameState1 = applyId(state, getTheme(state).data.id);
        expect(sameState1).toStrictEqual(state);
        const sameState2 = applyId(state, getLastTheme(state).data.id);
        expect(sameState2).toStrictEqual(state);
      });

      test("Only changes node with provided id", () => {
        const openedState1 = changeTheme((node) => ({ ...node, isOpen: true }))(
          state,
          getTheme(state).data.id,
        );
        const openedState2 = changeTheme((node) => ({ ...node, isOpen: true }))(
          state,
          getLastTheme(state).data.id,
        );
        expect(openedState1.children.slice(1).every((node) => !node.isOpen));
        expect(
          openedState2.children
            .slice(0, openedState2.children.length - 2)
            .every((node) => !node.isOpen),
        );
      });
    });

    describe("mapTheme", () => {
      const setPage0 = mapTheme((node) => ({ ...node, pagination: 0 }));
      const applyId = mapTheme(identity);

      test("Identity won't change anything", () => {
        const sameState = applyId(state);
        expect(sameState).toStrictEqual(state);
      });

      test("Applies to all themes", () => {
        const newState = setPage0(state);
        expect(newState.children.every((node) => node.pagination === 0)).true;
      });

      test("Doesn't apply to children", () => {
        const newState = setPage0(state);
        expect(
          newState.children
            .flatMap((theme) => theme.children)
            .every((topic) => topic.pagination !== 0),
        );
      });
    });
  });

  describe("Tranformers", () => {
    describe("openTheme", () => {
      const openedState1 = openTheme(state, getTheme(state).data.id);
      const openedState2 = openTheme(state, getLastTheme(state).data.id);

      test("Changed state", () => {
        expect(openedState1).not.toStrictEqual(state);
        expect(openedState2).not.toStrictEqual(state);
        expect(getTheme(openedState1).isOpen).true;
        expect(getLastTheme(openedState2).isOpen);
      });
    });

    describe("closeTheme", () => {
      const id = getTheme(state).data.id;
      const openedState = openTheme(state, id);

      test("Can close theme", () => {
        const closedState = closeTheme(openedState, id);
        expect(closedState).toStrictEqual(state);
      });
    });

    describe("toggleTheme", () => {
      const id = getTheme(state).data.id;
      const openedState = toggleTheme(state, id);
      const doesNothing = combineActions(toggleTheme, toggleTheme);

      test("toggle once to open", () => {
        expect(getTheme(openedState).isOpen).true;
      });

      test("toggle twice goes back to original pos", () => {
        expect(doesNothing(state, id)).toStrictEqual(state);
      });
    });

    describe("openAll", () => {
      test("opens all themes", () => {
        expect(openAllThemes(state).children.every((val) => val.isOpen)).true;
      });
    });

    describe("closeAll", () => {
      test("closes all themes", () => {
        expect(mapActions(openAllThemes, closeAllThemes)(state)).toStrictEqual(
          state,
        );
      });
    });

    describe("expandTheme", () => {
      const id = getTheme(state).data.id;
      const expandedState = expandTheme(state, id);
      test("Expanding theme increases pagination", () => {
        expect(getTheme(expandedState).pagination).greaterThan(
          getTheme(state).pagination,
        );
      });
    });

    describe("resetTheme", () => {
      const id = getTheme(state).data.id;
      const func = combineActions(expandTheme, resetTheme);
      test("Resetting theme brings it back to original", () => {
        expect(func(state, id)).toStrictEqual(state);
      });
    });
  });
});

//  ********************************
//  * Topic *
//  ********************************/
describe("Topic", () => {
  describe("Base Functions", () => {
    describe("findTopic", () => {
      const topic1 = getTopic(state);
      const topic2 = getLastTopic(state);

      test("Should find topic in reportState", () => {
        expect(findTopic(state, topic1.data.id)).toStrictEqual(topic1);
        expect(findTopic(state, topic2.data.id)).toStrictEqual(topic2);
      });

      test("Should throw an error if it doesn't exist", () => {
        expect(() => findTopic(state, "")).toThrowError();
      });
    });

    describe("findParent", () => {
      const firstTopicId = getTopic(state).data.id;
      const lastTopicId = getLastTopic(state).data.id;
      // const theme = parentOfTopic(state.children, firstTopicId);
      test("Expects to find parent of topicId", () => {
        expect(parentOfTopic(state.children, firstTopicId)).toStrictEqual(
          getTheme(state),
        );
        expect(parentOfTopic(state.children, lastTopicId)).toStrictEqual(
          getLastTheme(state),
        );
      });
    });
  });

  describe("Applicative Functions", () => {
    const topicId = getLastTopic(state).data.id;
    const applyId = changeTopic(identity);

    describe("changeTopic", () => {
      test("Identity should not affect anything", () => {
        expect(applyId(state, topicId)).toStrictEqual(state);
        expect(true).true;
      });

      test("Provided transformer should change topic", () => {
        const newState = changeTopic((topic) => ({
          ...topic,
          pagination: 9001,
        }))(state, topicId);
        expect(getLastTopic(newState).pagination).toBe(9001);
      });
    });

    describe("mapTopic", () => {
      const applyId = mapTopic(identity);
      const func = mapTopic((topic) => ({ ...topic, pagination: 9001 }));

      test("Identity should not affect anything", () => {
        expect(applyId(state)).toStrictEqual(state);
      });

      test("Transform should apply to every topic", () => {
        const newState = func(state);
        expect(
          newState.children
            .flatMap((node) => node.children)
            .every((topic) => topic.pagination === 9001),
        ).true;
      });
    });

    describe("mapThemeChildren", () => {
      const themeId = getLastTheme(state).data.id;
      const newState = mapThemeChildren((topic) => ({
        ...topic,
        pagination: 9001,
      }))(state, themeId);

      test("Should apply to children of correct theme", () => {
        expect(
          getLastTheme(newState).children.every(
            (node) => node.pagination === 9001,
          ),
        );
      });

      test("Should only apply to children of correct theme", () => {
        const otherPagNums = newState.children
          .filter((node) => node.data.id !== themeId)
          .flatMap((node) => node.children)
          .map((topic) => topic.pagination);

        const uniques = Array.from(new Set(otherPagNums));

        expect(uniques).length(1);
        expect(uniques[0]).toBe(defaultTopicPagination);
      });
    });
  });

  describe("Transformers", () => {
    const topic = getTopic(state);
    const topicId = topic.data.id;

    describe("expandTopic", () => {
      const newState = expandTopic(state, topicId);

      test("Should increase the topic's pagination", () => {
        expect(getTopic(newState).pagination).greaterThan(
          getTopic(state).pagination,
        );
      });
    });

    describe("resetTopic", () => {
      const newState = combineActions(expandTopic, resetTopic)(state, topicId);

      test("Resetting topic should bring it back to the default", () => {
        expect(newState).toStrictEqual(state);
      });
    });

    describe("resetThemeTopics", () => {
      const themeId = getTheme(state).data.id;
      const setupState = mapThemeChildren((topic) => ({
        ...topic,
        pagination: 9001,
      }));
      const newState = combineActions(setupState, resetThemesTopics)(
        state,
        themeId,
      );
      test("Restting theme's topics brings it back to default", () => {
        expect(newState).toStrictEqual(state);
      });
    });

    describe("resetAllTopics", () => {
      const setAllTopics = mapTopic((topic) => ({
        ...topic,
        pagination: 9001,
      }));
      const newState = mapActions(setAllTopics, resetAllTopics)(state);
      test("Resetting all topics should bring them back to the default", () => {
        expect(newState).toStrictEqual(state);
      });
    });
  });
});

//  ********************************
//  * Actions *
//  ********************************/
describe("Actions", () => {
  describe("open", () => {
    const openAction = (state: ReportState, id: string) =>
      reducer(state, { type: "open", payload: { id } });
    const id = getTheme(state).data.id;
    const lastId = getLastTheme(state).data.id;

    describe("Opening theme", () => {
      test("Opening with themeId sets theme to open", () => {
        const newState1 = openAction(state, id);
        expect(getTheme(newState1).isOpen).true;

        const newState2 = openAction(state, lastId);
        expect(getLastTheme(newState2).isOpen).true;
      });
    });

    describe("Opening topic", () => {
      const firstTopicId = getTopic(state).data.id;
      const lastTopicId = getLastTopic(state).data.id;
      const firstState = openAction(state, firstTopicId);
      const lastState = openAction(state, lastTopicId);
      test("Opening with topicId should set parent theme to open", () => {
        expect(getTheme(firstState).isOpen).true;
        expect(getLastTheme(lastState).isOpen).true;
      });

      describe("Opening with topicId should set pagination to correct value", () => {
        test("Topic is earlier than pagination", () => {
          expect(getTheme(firstState).pagination === defaultThemePagination);
        });

        test("Topic is later than pagination", () => {
          const deepTopicId = getTheme(state).children[
            getTheme(state).children.length - 1
          ].data.id as string;
          const deepState = openAction(state, deepTopicId);
          expect(getTheme(deepState).pagination).greaterThan(
            defaultThemePagination,
          );
        });
      });
    });
  });

  describe("close", () => {
    const close = (state: ReportState, id: string) =>
      reducer(state, { type: "close", payload: { id } });
    const themeId = getTheme(state).data.id;
    const topicId = getTopic(state).data.id;
    const setupTheme = combineActions(openTheme, expandTheme);

    const _setupState = setupTheme(state, themeId);
    const setupState = expandTopic(_setupState, topicId);

    const newState = close(setupState, themeId);

    test("Close should reset isOpen, pagination, and children pagination", () => {
      expect(newState).toStrictEqual(state);
    });
  });

  describe("openAll", () => {
    const openAllAction = (state: ReportState) =>
      reducer(state, { type: "openAll", payload: { id: "" } });
    const newState = openAllAction(state);
    test("Should set every theme to open", () => {
      expect(newState.children.every((node) => node.isOpen)).true;
    });
  });

  describe("closeAll", () => {
    const closeAllAction = (state: ReportState) =>
      reducer(state, { type: "closeAll", payload: { id: "" } });
    const setupFunc = mapActions(
      openAllThemes,
      mapTheme((node) => ({ ...node, pagination: 9001 })),
      mapTopic((node) => ({ ...node, pagination: 42 })),
    );
    const setupState = setupFunc(state);

    test("Opening and then closing does nothing", () => {
      expect(mapActions(openAllThemes, closeAllAction));
    });

    test("Closing all should close, reset themes and topics", () => {
      expect(closeAllAction(setupState)).toStrictEqual(state);
    });
  });

  describe("expandTheme", () => {
    const expandThemeAction = (state: ReportState, id: string) =>
      reducer(state, { type: "expandTheme", payload: { id } });
    const themeId = getTheme(state).data.id;
    test("Expanding theme should increase pagination by some const", () => {
      const newState = expandThemeAction(state, themeId);
      expect(getTheme(newState).pagination).toBe(
        getTheme(state).pagination + addThemePagination,
      );
    });
  });

  describe("expandTopic", () => {
    const expandTopicAction = (state: ReportState, id: string) =>
      reducer(state, { type: "expandTopic", payload: { id } });
    const topicId = getTopic(state).data.id;
    test("Expanding topic should increase pagination by some const", () => {
      const newState = expandTopicAction(state, topicId);
      expect(getTopic(newState).pagination).toBe(
        getTopic(state).pagination + addTopicPagination,
      );
    });
  });
});
