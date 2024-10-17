import { describe, expect, test } from "vitest";
import {
  __internals as __useReportStateInternals,
  SomeNode,
} from "../../report/hooks/useReportState";
import { OutlineNode, OutlineTree, __internals } from "./useOutlineState";
import { reportData } from "stories/data/dummyData";

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

const reportState = stateBuilder(reportData.topics);
const state = outlineStateBuilder(reportState.children);
const getTopic = (state: OutlineTree, idx = 0) => state[idx];
const getLastTopic = (state: OutlineTree) => getTopic(state, state.length - 1);
const getSubsubtopic = (state: OutlineTree, topicIdx = 0, subtopicIdx = 0) =>
  undefinedCheck(getTopic(state, topicIdx).children![subtopicIdx]);
const getLastSubsubtopic = (state: OutlineTree, topicIdx = 0) =>
  undefinedCheck(
    getLastTopic(state).children![getLastTopic(state).children!.length - 1],
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
      expect(findOutlineNode(state, getTopic(state).id)).toStrictEqual(
        getTopic(state),
      );
      expect(findOutlineNode(state, getLastTopic(state).id)).toStrictEqual(
        getLastTopic(state),
      );
    });

    test("Can find nodes on second level", () => {
      expect(findOutlineNode(state, getSubsubtopic(state).id)).toStrictEqual(
        getSubsubtopic(state),
      );
    });
  });
});

describe("Builder", () => {
  describe("outlineStateBuilder", () => {
    test("Can build outline nodes without recursion", () => {
      const claimNodes = reportState.children.flatMap((topic) =>
        topic.children.flatMap((subtopic) => subtopic.children),
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
      const outlineSubsubtopics = outlineNodes.flatMap((node) => node.children);
      const outlineClaims = outlineSubsubtopics.flatMap(
        (node) => node?.children,
      );
      const getOutlineTitles = (node: OutlineNode) => node.title;

      const reportSubsubtopics = reportState.children.flatMap(
        (topic) => topic.children,
      );
      const reportClaims = reportSubsubtopics.flatMap(
        (subtopic) => subtopic.children,
      );
      const getReportStateTitles = (node: SomeNode) => node.data.title;

      // matches topics
      expect(outlineNodes.map(getOutlineTitles).sort()).toEqual(
        reportState.children.map(getReportStateTitles).sort(),
      );

      // matches subtopics
      expect(outlineSubsubtopics.map(getOutlineTitles).sort()).toEqual(
        reportSubsubtopics.map(getReportStateTitles).sort(),
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
    const changedTopicState = transform(state, getTopic(state).id);
    const changedLastTopicState = transform(state, getLastTopic(state).id);

    const changedSubsubtopicState = transform(state, getSubsubtopic(state).id);
    const changedLastSubsubtopicState = transform(
      state,
      getLastSubsubtopic(state).id,
    );

    test("Can find and tranform the state in the first level of nodes", () => {
      expect(getTopic(changedTopicState).title).toBe(newTitle);
      expect(getLastTopic(changedLastTopicState).title).toBe(newTitle);
    });

    test("Function doesn't apply to nodes on first level that are not the provided id", () => {
      expect(getLastTopic(changedTopicState).title).not.toBe(newTitle);
      expect(getTopic(changedLastTopicState).title).not.toBe(newTitle);
    });

    test("Function applies to nodes on second level", () => {
      expect(getSubsubtopic(changedSubsubtopicState).title).toBe(newTitle);
      expect(getLastSubsubtopic(changedLastSubsubtopicState).title).toBe(
        newTitle,
      );
    });

    test("Function doesn't apply to nodes on second level that are not the provided id", () => {
      expect(getLastTopic(changedSubsubtopicState).title).not.toBe(newTitle);
      expect(getTopic(changedLastSubsubtopicState).title).not.toBe(newTitle);
    });
  });

  describe("mapWithChildren", () => {
    const newTitle = "This node changed";
    const transform = mapWithChildren((node) => ({ ...node, title: newTitle }));
    const changedFirstTopic = transform(state, getTopic(state).id);
    const changedLastTopic = transform(state, getLastTopic(state).id);
    const changedFirstSubsubtopic = transform(state, getSubsubtopic(state).id);
    const changedLastSubsubtopic = transform(
      state,
      getLastSubsubtopic(state).id,
    );

    test("Transform doesn't change order", () => {
      const flattenedStateIds: string[] = flattenTree(state).map(getId);
      expect(flattenTree(changedFirstTopic).map(getId)).toEqual(
        flattenedStateIds,
      );
      expect(flattenTree(changedLastTopic).map(getId)).toEqual(
        flattenedStateIds,
      );
      expect(flattenTree(changedFirstSubsubtopic).map(getId)).toEqual(
        flattenedStateIds,
      );
      expect(flattenTree(changedLastSubsubtopic).map(getId)).toEqual(
        flattenedStateIds,
      );
    });

    test("Transform should apply to node with id", () => {
      expect(getTopic(changedFirstTopic).title).toBe(newTitle);
      expect(getLastTopic(changedLastTopic).title).toBe(newTitle);
      expect(getSubsubtopic(changedFirstSubsubtopic).title).toBe(newTitle);
      expect(getLastSubsubtopic(changedLastSubsubtopic).title).toBe(newTitle);
    });

    test("Transform does not apply to other nodes on the same level", () => {
      expect(getLastTopic(changedFirstTopic).title).not.toBe(newTitle);
      expect(getTopic(changedLastTopic).title).not.toBe(newTitle);
      expect(getLastSubsubtopic(changedFirstSubsubtopic).title).not.toBe(
        newTitle,
      );
      expect(getSubsubtopic(changedLastSubsubtopic).title).not.toBe(newTitle);
    });

    test("Transform applies to children nodes", () => {
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
      expect(
        getAllChildrenOf(
          changedFirstSubsubtopic,
          getSubsubtopic(changedFirstSubsubtopic).id,
        )
          .map((node) => node.title)
          .every((title) => title === newTitle),
      ).true;
      expect(
        getAllChildrenOf(
          changedLastSubsubtopic,
          getLastSubsubtopic(changedLastSubsubtopic).id,
        )
          .map((node) => node.title)
          .every((title) => title === newTitle),
      ).true;
    });
  });
  describe("mapWithParents", () => {
    const newTitle = "this node will change";
    const transform = mapWithParents((node) => ({ ...node, title: newTitle }));

    const changedFirstTopic = transform(state, getTopic(state).id);
    const changedLastTopic = transform(state, getLastTopic(state).id);
    const changedFirstSubsubtopic = transform(state, getSubsubtopic(state).id);
    const changedLastSubsubtopic = transform(
      state,
      getLastSubsubtopic(state).id,
    );

    test("Transform doesn't change order", () => {
      const flattenedStateIds: string[] = flattenTree(state).map(getId);
      expect(flattenTree(changedFirstTopic).map(getId)).toEqual(
        flattenedStateIds,
      );
      expect(flattenTree(changedLastTopic).map(getId)).toEqual(
        flattenedStateIds,
      );
      expect(flattenTree(changedFirstSubsubtopic).map(getId)).toEqual(
        flattenedStateIds,
      );
      expect(flattenTree(changedLastSubsubtopic).map(getId)).toEqual(
        flattenedStateIds,
      );
    });

    test("Transform should apply to node with id", () => {
      expect(getTopic(changedFirstTopic).title).toBe(newTitle);
      expect(getLastTopic(changedLastTopic).title).toBe(newTitle);
      expect(getSubsubtopic(changedFirstSubsubtopic).title).toBe(newTitle);
      expect(getLastSubsubtopic(changedLastSubsubtopic).title).toBe(newTitle);
    });

    test("Transform does not apply to other nodes on the same level", () => {
      expect(getLastTopic(changedFirstTopic).title).not.toBe(newTitle);
      expect(getTopic(changedLastTopic).title).not.toBe(newTitle);
      expect(getLastSubsubtopic(changedFirstSubsubtopic).title).not.toBe(
        newTitle,
      );
      expect(getSubsubtopic(changedLastSubsubtopic).title).not.toBe(newTitle);
    });

    test("Transform does not apply to children nodes", () => {
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
      expect(
        getAllChildrenOf(
          changedFirstSubsubtopic,
          getSubsubtopic(changedFirstSubsubtopic).id,
        )
          .map((node) => node.title)
          .every((title) => title === newTitle),
      ).not.true;
      expect(
        getAllChildrenOf(
          changedLastSubsubtopic,
          getLastSubsubtopic(changedLastSubsubtopic).id,
        )
          .map((node) => node.title)
          .every((title) => title === newTitle),
      ).not.true;
    });

    test("When a subtopic node is changed, a topic node is changed", () => {
      expect(getTopic(changedFirstSubsubtopic).title).toBe(newTitle);
      expect(getLastTopic(changedLastSubsubtopic).title).toBe(newTitle);
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
        const test = open(state, getTopic(state).id);
        expect(getTopic(test).isOpen).true;
      });

      test("second level", () => {
        const test = open(state, getSubsubtopic(state).id);
        expect(getSubsubtopic(test).isOpen).true;
      });
    });

    test("Opening child should open parent", () => {
      const test = open(state, getSubsubtopic(state).id);
      expect(getTopic(test).isOpen).true;
    });
  });

  describe("Close", () => {
    const _openState = open(state, getTopic(state).id);
    const openState = open(_openState, getSubsubtopic(state).id);
    const closedTopic = close(openState, getTopic(state).id);
    const closedSubsubtopic = close(openState, getSubsubtopic(state).id);

    test("Close should close provided node", () => {
      expect(getTopic(closedTopic).isOpen).false;
      expect(getSubsubtopic(closedSubsubtopic).isOpen).false;
    });

    test("Closing parent should close children", () => {
      expect(getSubsubtopic(closedTopic).isOpen).false;
    });

    test("Closing child should not close parent", () => {
      expect(getTopic(closedSubsubtopic).isOpen).true;
    });
  });

  describe("toggle", () => {
    const openedState = toggle(state, getLastSubsubtopic(state).id);
    test("Toggling closed => opened", () => {
      expect(getLastSubsubtopic(openedState).isOpen).true;
    });

    test("Toggling open => closed", () => {
      const closedState = toggle(openedState, getLastSubsubtopic(state).id);
      expect(getLastSubsubtopic(closedState).isOpen).false;
    });
  });
});
