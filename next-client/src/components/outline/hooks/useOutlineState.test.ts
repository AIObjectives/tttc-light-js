import { describe, expect, test } from "vitest";
import { __internals as __useReportStateInternals } from "../../report/hooks/useReportState";
import { OutlineNode, OutlineTree, __internals } from "./useOutlineState";
import { reportData } from "stories/data/dummyData";
import { SomeNode } from "@src/types";

const { stateBuilder, undefinedCheck } = __useReportStateInternals;

const {
  outlineStateBuilder,
  findAndTransform,
  mapWithChildren,
  mapWithParents,
  mapOutline,
  findOutlineNode,
  flattenTree,
  open,
  close,
  toggle,
  openAll,
  closeAll,
} = __internals;

const reportState = stateBuilder(reportData.themes);
const state = outlineStateBuilder(reportState.children);
const getTheme = (state: OutlineTree, idx = 0) => state[idx];
const getLastTheme = (state: OutlineTree) => getTheme(state, state.length - 1);
const getTopic = (state: OutlineTree, themeIdx = 0, topicIdx = 0) =>
  undefinedCheck(getTheme(state, themeIdx).children![topicIdx]);
const getLastTopic = (state: OutlineTree, themeIdx = 0) =>
  undefinedCheck(
    getLastTheme(state).children![getLastTheme(state).children!.length - 1],
  );

const _getChildren = (node: OutlineNode) =>
  node.children
    ? [...node.children, ...node.children.flatMap(_getChildren)]
    : [];
const getAllChildrenOf = (tree: OutlineTree, id: string): OutlineNode[] =>
  _getChildren(findOutlineNode(tree, id));
const getId = (node: OutlineNode) => node.id;
const getArrayDepth = <T>(arr: T) => {
  if (!Array.isArray(arr)) return 0;
  return 1 + Math.max(...arr.map(getArrayDepth), 0);
};

describe("Utility Functions", () => {
  describe("flattenTree", () => {
    const flatten = flattenTree(state);
    test("Flatten tree brings depth to 1", () => {
      expect(getArrayDepth(flatten)).toBe(1);
    });
  });

  describe("findOutlineNode", () => {
    test("Can find nodes on first level", () => {
      expect(findOutlineNode(state, getTheme(state).id)).toStrictEqual(
        getTheme(state),
      );
      expect(findOutlineNode(state, getLastTheme(state).id)).toStrictEqual(
        getLastTheme(state),
      );
    });

    test("Can find nodes on second level", () => {
      expect(findOutlineNode(state, getTopic(state).id)).toStrictEqual(
        getTopic(state),
      );
    });
  });
});

describe("Builder", () => {
  describe("outlineStateBuilder", () => {
    test("Can build outline nodes without recursion", () => {
      const claimNodes = reportState.children.flatMap((theme) =>
        theme.children.flatMap((topic) => topic.children),
      );
      expect(claimNodes.map((node) => node.data)[0]).toHaveProperty(
        "similarClaims",
      );
      const outlineNodes = outlineStateBuilder(claimNodes);
      expect(outlineNodes.length).toBe(claimNodes.length);
      expect(outlineNodes[0].children).undefined;
      expect(claimNodes.map((node) => node.data.title).sort()).toEqual(
        outlineNodes.map((node) => node.title).sort(),
      );
    });

    test("Can recursively build nodes", () => {
      const outlineNodes = outlineStateBuilder(reportState.children);
      const outlineTopics = outlineNodes.flatMap((node) => node.children);
      const outlineClaims = outlineTopics.flatMap((node) => node?.children);
      const getOutlineTitles = (node: OutlineNode) => node.title;

      const reportTopics = reportState.children.flatMap(
        (theme) => theme.children,
      );
      const reportClaims = reportTopics.flatMap((topic) => topic.children);
      const getReportStateTitles = (node: SomeNode) => node.data.title;

      // matches themes
      expect(outlineNodes.map(getOutlineTitles).sort()).toEqual(
        reportState.children.map(getReportStateTitles).sort(),
      );

      // matches topics
      expect(outlineTopics.map(getOutlineTitles).sort()).toEqual(
        reportTopics.map(getReportStateTitles).sort(),
      );

      // matches claims
      expect(outlineClaims.map(getOutlineTitles).sort()).toEqual(
        reportClaims.map(getReportStateTitles).sort(),
      );
    });
  });
});

describe("Applicative Functions", () => {
  describe("findAndTransform", () => {
    const newTitle = "This node changed";
    const transform = findAndTransform((node) => ({
      ...node,
      title: newTitle,
    }));
    const changedThemeState = transform(state, getTheme(state).id);
    const changedLastThemeState = transform(state, getLastTheme(state).id);

    const changedTopicState = transform(state, getTopic(state).id);
    const changedLastTopicState = transform(state, getLastTopic(state).id);

    test("Can find and tranform the state in the first level of nodes", () => {
      expect(getTheme(changedThemeState).title).toBe(newTitle);
      expect(getLastTheme(changedLastThemeState).title).toBe(newTitle);
    });

    test("Function doesn't apply to nodes on first level that are not the provided id", () => {
      expect(getLastTheme(changedThemeState).title).not.toBe(newTitle);
      expect(getTheme(changedLastThemeState).title).not.toBe(newTitle);
    });

    test("Function applies to nodes on second level", () => {
      expect(getTopic(changedTopicState).title).toBe(newTitle);
      expect(getLastTopic(changedLastTopicState).title).toBe(newTitle);
    });

    test("Function doesn't apply to nodes on second level that are not the provided id", () => {
      expect(getLastTheme(changedTopicState).title).not.toBe(newTitle);
      expect(getTheme(changedLastTopicState).title).not.toBe(newTitle);
    });
  });

  describe("mapWithChildren", () => {
    const newTitle = "This node changed";
    const transform = mapWithChildren((node) => ({ ...node, title: newTitle }));
    const changedFirstTheme = transform(state, getTheme(state).id);
    const changedLastTheme = transform(state, getLastTheme(state).id);
    const changedFirstTopic = transform(state, getTopic(state).id);
    const changedLastTopic = transform(state, getLastTopic(state).id);

    test("Transform doesn't change order", () => {
      const flattenedStateIds: string[] = flattenTree(state).map(getId);
      expect(flattenTree(changedFirstTheme).map(getId)).toEqual(
        flattenedStateIds,
      );
      expect(flattenTree(changedLastTheme).map(getId)).toEqual(
        flattenedStateIds,
      );
      expect(flattenTree(changedFirstTopic).map(getId)).toEqual(
        flattenedStateIds,
      );
      expect(flattenTree(changedLastTopic).map(getId)).toEqual(
        flattenedStateIds,
      );
    });

    test("Transform should apply to node with id", () => {
      expect(getTheme(changedFirstTheme).title).toBe(newTitle);
      expect(getLastTheme(changedLastTheme).title).toBe(newTitle);
      expect(getTopic(changedFirstTopic).title).toBe(newTitle);
      expect(getLastTopic(changedLastTopic).title).toBe(newTitle);
    });

    test("Transform does not apply to other nodes on the same level", () => {
      expect(getLastTheme(changedFirstTheme).title).not.toBe(newTitle);
      expect(getTheme(changedLastTheme).title).not.toBe(newTitle);
      expect(getLastTopic(changedFirstTopic).title).not.toBe(newTitle);
      expect(getTopic(changedLastTopic).title).not.toBe(newTitle);
    });

    test("Transform applies to children nodes", () => {
      expect(
        getAllChildrenOf(changedFirstTheme, getTheme(changedFirstTheme).id)
          .map((node) => node.title)
          .every((title) => title === newTitle),
      ).true;
      expect(
        getAllChildrenOf(changedLastTheme, getLastTheme(changedLastTheme).id)
          .map((node) => node.title)
          .every((title) => title === newTitle),
      ).true;
      expect(
        getAllChildrenOf(changedFirstTopic, getTopic(changedFirstTopic).id)
          .map((node) => node.title)
          .every((title) => title === newTitle),
      ).true;
      expect(
        getAllChildrenOf(changedLastTopic, getLastTopic(changedLastTopic).id)
          .map((node) => node.title)
          .every((title) => title === newTitle),
      ).true;
    });
  });
  describe("mapWithParents", () => {
    const newTitle = "this node will change";
    const transform = mapWithParents((node) => ({ ...node, title: newTitle }));

    const changedFirstTheme = transform(state, getTheme(state).id);
    const changedLastTheme = transform(state, getLastTheme(state).id);
    const changedFirstTopic = transform(state, getTopic(state).id);
    const changedLastTopic = transform(state, getLastTopic(state).id);

    test("Transform doesn't change order", () => {
      const flattenedStateIds: string[] = flattenTree(state).map(getId);
      expect(flattenTree(changedFirstTheme).map(getId)).toEqual(
        flattenedStateIds,
      );
      expect(flattenTree(changedLastTheme).map(getId)).toEqual(
        flattenedStateIds,
      );
      expect(flattenTree(changedFirstTopic).map(getId)).toEqual(
        flattenedStateIds,
      );
      expect(flattenTree(changedLastTopic).map(getId)).toEqual(
        flattenedStateIds,
      );
    });

    test("Transform should apply to node with id", () => {
      expect(getTheme(changedFirstTheme).title).toBe(newTitle);
      expect(getLastTheme(changedLastTheme).title).toBe(newTitle);
      expect(getTopic(changedFirstTopic).title).toBe(newTitle);
      expect(getLastTopic(changedLastTopic).title).toBe(newTitle);
    });

    test("Transform does not apply to other nodes on the same level", () => {
      expect(getLastTheme(changedFirstTheme).title).not.toBe(newTitle);
      expect(getTheme(changedLastTheme).title).not.toBe(newTitle);
      expect(getLastTopic(changedFirstTopic).title).not.toBe(newTitle);
      expect(getTopic(changedLastTopic).title).not.toBe(newTitle);
    });

    test("Transform does not apply to children nodes", () => {
      expect(
        getAllChildrenOf(changedFirstTheme, getTheme(changedFirstTheme).id)
          .map((node) => node.title)
          .every((title) => title === newTitle),
      ).not.true;
      expect(
        getAllChildrenOf(changedLastTheme, getLastTheme(changedLastTheme).id)
          .map((node) => node.title)
          .every((title) => title === newTitle),
      ).not.true;
      expect(
        getAllChildrenOf(changedFirstTopic, getTopic(changedFirstTopic).id)
          .map((node) => node.title)
          .every((title) => title === newTitle),
      ).not.true;
      expect(
        getAllChildrenOf(changedLastTopic, getLastTopic(changedLastTopic).id)
          .map((node) => node.title)
          .every((title) => title === newTitle),
      ).not.true;
    });

    test("When a topic node is changed, a theme node is changed", () => {
      expect(getTheme(changedFirstTopic).title).toBe(newTitle);
      expect(getLastTheme(changedLastTopic).title).toBe(newTitle);
    });
  });

  describe("mapOutline", () => {
    const newTitle = "This has changed";
    const transform = mapOutline((node) => ({ ...node, title: newTitle }));

    test("Transformer maps to every outlinenode", () => {
      const testState = transform(state);
      const flattened = flattenTree(testState);
      const titles = flattened.map((node) => node.title);
      expect(titles.every((title) => newTitle === title)).true;
    });
  });
});

describe("Tranformers", () => {
  describe("open", () => {
    describe("Open should open provided node", () => {
      test("first level", () => {
        const test = open(state, getTheme(state).id);
        expect(getTheme(test).isOpen).true;
      });

      test("second level", () => {
        const test = open(state, getTopic(state).id);
        expect(getTopic(test).isOpen).true;
      });
    });

    test("Opening child should open parent", () => {
      const test = open(state, getTopic(state).id);
      expect(getTheme(test).isOpen).true;
    });
  });

  describe("Close", () => {
    const _openState = open(state, getTheme(state).id);
    const openState = open(_openState, getTopic(state).id);
    const closedTheme = close(openState, getTheme(state).id);
    const closedTopic = close(openState, getTopic(state).id);

    test("Close should close provided node", () => {
      expect(getTheme(closedTheme).isOpen).false;
      expect(getTopic(closedTopic).isOpen).false;
    });

    test("Closing parent should close children", () => {
      expect(getTopic(closedTheme).isOpen).false;
    });

    test("Closing child should not close parent", () => {
      expect(getTheme(closedTopic).isOpen).true;
    });
  });

  describe("toggle", () => {
    const openedState = toggle(state, getLastTopic(state).id);
    test("Toggling closed => opened", () => {
      expect(getLastTopic(openedState).isOpen).true;
    });

    test("Toggling open => closed", () => {
      const closedState = toggle(openedState, getLastTopic(state).id);
      expect(getLastTopic(closedState).isOpen).false;
    });
  });
});
