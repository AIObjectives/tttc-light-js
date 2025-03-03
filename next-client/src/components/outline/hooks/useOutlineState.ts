"use client";

import {
  ReportState,
  SomeNode,
} from "@src/components/report/hooks/useReportState";
import {
  useThemeColor,
  TextClass,
  TextHoverClass,
} from "@src/lib/hooks/useTopicTheme";
import assert from "assert";
import { Dispatch, useReducer } from "react";
import * as schema from "tttc-common/schema";
//  ********************************
//  * Types *
//  ********************************/

type Transform = (arg: OutlineNode) => OutlineNode;
type EqualsTransform = (arg: Transform, id: string) => Transform;

export type OutlineNode = {
  id: string;
  title: string;
  isOpen: boolean;
  isHighlighted: boolean;
  color: TextClass;
  hoverColor: TextHoverClass;
  children?: OutlineNode[];
};

export type OutlineTree = OutlineNode[];

const undefinedCheck = <T>(
  arg: T | undefined,
  errorMessage: string = "Falsy check failed",
) => {
  if (arg === undefined) {
    throw new Error(errorMessage);
  }
  return arg;
};

/**
 * Takes OutlineTree and flattens it to an array of its nodes
 */
const flattenTree = (tree: OutlineTree): OutlineNode[] => [
  ...tree,
  ...tree.flatMap(_getChildren),
];

const _getChildren = (node: OutlineNode) =>
  node.children
    ? [...node.children, ...node.children.flatMap(_getChildren)]
    : [];

/**
 * Find OutlineNode in tree by id
 */
const findOutlineNode = (tree: OutlineTree, id: string) =>
  undefinedCheck(_findOutlineNode(tree, id));

const _findOutlineNode = (
  tree: OutlineTree,
  id: string,
): OutlineNode | undefined => flattenTree(tree).find((node) => node.id === id);

const identity = <T>(arg: T): T => arg;

//  ********************************
//  * Applicative Functions *
//  ********************************/

/**
 * HOC - Creates a transform function that only applies when node.id matches
 */
const equalsTransform: EqualsTransform =
  (transform, id) => (node: OutlineNode) =>
    node.id === id ? transform(node) : identity(node);

/**
 * HOC - Creates a function that applies a transform to a specific node
 */
const findAndTransform =
  (transform: Transform) => (outline: OutlineTree, id: string) =>
    outline.map((node) =>
      _findAndTransform(equalsTransform(transform, id), node),
    );
//
const _findAndTransform = (transform: Transform, node: OutlineNode) => {
  if (!node.children) return transform(node);
  const children = node.children.map((subnode) =>
    _findAndTransform(transform, subnode),
  );
  return transform({
    ...node,
    children,
  });
};

/**
 * HOC - maps transform to all children of a particular node.
 */
const mapWithChildren =
  (transform: Transform) =>
  (tree: OutlineTree, id: string): OutlineTree =>
    tree.map((node) => _mapWithChildren(transform, node, id));
//
const _mapWithChildren = (
  transform: Transform,
  node: OutlineNode,
  id: string,
  applyAll: boolean = false,
): OutlineNode => {
  const apply = node.id === id || applyAll ? transform : identity;
  return apply({
    ...node,
    children: node.children
      ? node.children.map((subnode) =>
          _mapWithChildren(transform, subnode, id, node.id === id || applyAll),
        )
      : node.children,
  });
};

/**
 * HOC - Maps transform to entire state
 */
const mapOutline = (transform: Transform) => (tree: OutlineTree) =>
  tree.map((node) => _mapOutline(transform, node));
//
const _mapOutline = (transform: Transform, node: OutlineNode): OutlineNode =>
  transform({
    ...node,
    children: node.children
      ? node.children.map((subnode) => _mapOutline(transform, subnode))
      : node.children,
  });

type ValAction = [OutlineNode, Transform];
/**
 * HOC - Maps transform to node and its parents.
 * Goes through state tree recursively. Passes either identity or transform function to parent, which applies to itself and continues up the tree.
 */
const mapWithParents =
  (transform: Transform) =>
  (tree: OutlineTree, id: string): OutlineTree =>
    tree.map((node) => _mapWithParents(transform, node, id)[0]);
//
const _mapWithParents = (
  transform: Transform,
  node: OutlineNode,
  id: string,
): ValAction => {
  // Base case: If no children and not node we're looking for, return node and identity function
  if (!node.children && node.id !== id) return [node, identity];
  // Base case: If node we're looking for, return the transformed node and the transformation function
  if (node.id === id) return [transform(node), transform];
  assert(node.children);
  // Recursively go through tree and get back nodes and functions
  const childrenRes: ValAction[] = node.children.map((subnode) =>
    _mapWithParents(transform, subnode, id),
  );
  // Nodes
  const childrenVals = childrenRes.map((tup) => tup[0]);
  // Functions
  const childrenActions = childrenRes.map((tup) => tup[1]);
  // Reduce functions. Should only have either Identity or one instance of transform. Composed = transform | identity
  const reducedTransform = childrenActions.reduce((accum, curr) => {
    return (node: OutlineNode) => curr(accum(node));
  }, identity as Transform);

  // Apply reduced function to node and return with reduced function to apply to parent.
  return [
    reducedTransform({
      ...node,
      children: childrenVals,
    }),
    reducedTransform,
  ];
};

//  ********************************
//  * Transformers *
//  ********************************/

const open = mapWithParents((node) => ({
  ...node,
  isOpen: true,
}));

const close = mapWithChildren((node) => ({
  ...node,
  isOpen: false,
}));

const toggle = (tree: OutlineTree, id: string) =>
  findOutlineNode(tree, id).isOpen ? close(tree, id) : open(tree, id);

const openAll = mapOutline((node) => ({ ...node, isOpen: true }));

const closeAll = mapOutline((node) => ({ ...node, isOpen: false }));

const highlight = (state: OutlineTree, id: string) => {
  const resetedState = mapOutline((node) => ({
    ...node,
    isHighlighted: false,
  }))(state);
  return findAndTransform((node) => ({ ...node, isHighlighted: true }))(
    resetedState,
    id,
  );
};

//  ********************************
//  * State Builder *
//  ********************************/

const chooseColor = (
  node: SomeNode,
  parentColor: TextClass | undefined,
): TextClass => {
  const parsed = schema.topic.safeParse(node.data);
  if (parsed.success) {
    return useThemeColor(parsed.data.topicColor, "text");
  } else if (parentColor) {
    return parentColor;
  } else {
    throw new Error(
      "outline state builder chooseColor - should have either a topicColor or parent color.",
    );
  }
};

const chooseHoverColor = (
  node: SomeNode,
  parentHoverColor: TextHoverClass | undefined,
): TextHoverClass => {
  const parsed = schema.topic.safeParse(node.data);
  if (parsed.success) {
    return useThemeColor(parsed.data.topicColor, "textHover");
  } else if (parentHoverColor) {
    return parentHoverColor;
  } else {
    throw new Error(
      "outline state builder chooseHoverColor - should have either a topicColor or parent color.",
    );
  }
};

const outlineStateBuilder = (
  nodes: SomeNode[],
  color?: TextClass | undefined,
  hoverColor?: TextHoverClass | undefined,
): OutlineNode[] =>
  nodes.map((node) => ({
    id: node.data.id,
    title: node.data.title,
    isOpen: false,
    isHighlighted: false,
    color: chooseColor(node, color),
    hoverColor: chooseHoverColor(node, hoverColor),
    children:
      "children" in node
        ? outlineStateBuilder(
            node.children,
            chooseColor(node, color),
            chooseHoverColor(node, hoverColor),
          )
        : undefined,
  }));

type OutlineStateActionsWithId = {
  type: "open" | "close" | "toggle" | "highlight";
  payload: { id: string };
};

type OutlineStateActionsWithoutId = {
  type: "openAll" | "closeAll";
};

export type OutlineStateAction =
  | OutlineStateActionsWithId
  | OutlineStateActionsWithoutId;

function reducer(state: OutlineTree, action: OutlineStateAction): OutlineTree {
  switch (action.type) {
    case "open": {
      const { id } = action.payload;
      return open(state, id);
    }
    case "close": {
      const { id } = action.payload;
      return close(state, id);
    }
    case "toggle": {
      const { id } = action.payload;
      return toggle(state, id);
    }
    case "openAll": {
      return openAll(state);
    }
    case "closeAll": {
      return closeAll(state);
    }
    case "highlight": {
      const { id } = action.payload;
      return highlight(state, id);
    }
    default: {
      return state;
    }
  }
}

function useOutlineState(
  reportState: ReportState,
): [OutlineTree, Dispatch<OutlineStateAction>] {
  const [state, dispatch] = useReducer(
    reducer,
    outlineStateBuilder(reportState.children),
  );
  return [state, dispatch];
}

export const __internals = {
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
};

export default useOutlineState;
