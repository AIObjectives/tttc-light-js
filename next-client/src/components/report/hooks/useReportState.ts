"use client";

import * as schema from "tttc-common/schema";

/********************************
 * TYPE DEFINITIONS
 ********************************/

/**
 * All Node.data should have an id for easy lookup
 */
export type HasId = { id: string };
export type TreeParams = HasId[];

/**
 * Recursive definition for a tree of Nodes. Should be either Node or Node & {children}
 * Provide types in an array. Ex: NodeTree<[A,B]>, B will be the children of A
 */
export type NodeTree<T extends HasId[], Depth extends number = 0> = T extends [
  infer First,
  ...infer Rest,
]
  ? First extends HasId
    ? Rest extends HasId[]
      ? Rest extends []
        ? Node<First>
        : Node<First> & { children: NodeTree<Rest, [1, 2, 3, 4, 5][Depth]>[] }
      : never
    : never
  : never;

/**
 * A single Node in the NodeTree. Wraps data.
 */
export type Node<T> = {
  data: Readonly<T>;
  isOpen: boolean | null; // boolean if open-able, null if always closed
  isObserved: boolean;
};

/**
 * Report State - highest level implementation
 */
export type ReportState = {
  children: NodeTree<[schema.Theme, schema.Topic]>[];
};

/**
 * Nodes with Themes as data
 */
export type ThemeState = Unpacked<ReportState["children"]>;

/**
 * Nodes with Topic as data
 */
export type TopicState = Unpacked<ThemeState["children"]>;
// export type TopicState = NodeChildren<ThemeState, schema.Topic>

type Test<T> =
  T extends NodeTree<any> ? T : T extends TreeParams ? NodeTree<T> : never;

/**
 * Function type: NodeTree => NodeTree
 */
export type TransformFunction<K extends TreeParams> = (
  tree: NodeTree<K>,
) => NodeTree<K>;

type ChainTransform<K extends TreeParams> = (
  func: (arg: TransformFunction<K>) => TransformFunction<K>,
) => TransformFunction<K>;

/**
 * Utility Type: A[] => A
 */
export type Unpacked<T> = T extends (infer U)[] ? U : T;

/********************************
 * Helper functions
 ********************************/

/**
 * Takes a T[] and replaces T[idx] with T
 */
const replace = <T>(state: T[], val: T, idx: number): T[] => [
  ...state.slice(0, idx),
  val,
  ...state.slice(idx + 1),
];

/**
 * Returns same arg
 */
const identity = <T>(arg: T) => arg;

/**
 * Takes a transformation function and wraps guard functions around it
 */
const apply = <K extends TreeParams>(
  transform: TransformFunction<K>,
  guardFuncs: ChainTransform<K>[],
) => {
  const guard: ChainTransform<K> = guardFuncs.reduce((accum, curr) => {
    return (func) => accum(curr(func));
  }, identity as ChainTransform<K>);
  return guard(transform);
};

/********************************
 * Transformer guards
 ********************************/

/**
 * If NodeTree has isOpen set to null, don't change it.
 */
const guardNullIsOpen =
  <K extends TreeParams>(func: TransformFunction<K>) =>
  (tree: NodeTree<K>): NodeTree<K> =>
    tree.isOpen === null ? identity(tree) : func(tree);

const guardDataMutation =
  <K extends TreeParams>(func: TransformFunction<K>) =>
  (tree: NodeTree<K>): NodeTree<K> => {
    const res = func(tree);
    if (JSON.stringify(tree.data) === JSON.stringify(res.data)) {
      return res;
    }
    console.error("Node data should not be changed!");
    return identity(tree);
  };

/**
 * Should be used with every transform function
 */
const universalGuard = <K extends TreeParams>(
  transform: TransformFunction<K>,
) => apply(transform, [guardDataMutation]);

/********************************
 * Transformers
 ********************************/

const _setIsOpen =
  (val: boolean) =>
  <K extends TreeParams>(tree: NodeTree<K>): NodeTree<K> => ({
    ...tree,
    isOpen: val,
  });
const _setIsOpenTranformer = (val: boolean) =>
  apply(_setIsOpen(val), [universalGuard, guardNullIsOpen]);

const open = _setIsOpenTranformer(true);
const close = _setIsOpenTranformer(false);

const _setIsObservable =
  (val: boolean) =>
  <K extends TreeParams>(tree: NodeTree<K>): NodeTree<K> => ({
    ...tree,
    isObserved: val,
  });
const unsafeObserve = _setIsObservable(true);
const unsafeUnobserve = _setIsObservable(false);

/**
 * Will look for and replace the node with data.id == id provided based on the transform function. Should not manipulate data property.
 */
const findAndReplace =
  (state: ReportState) =>
  (transform: TransformFunction<[any]>) =>
  (id: string): ReportState => {
    const idx = state.children.findIndex((node) => node.data.id === id);

    if (idx === -1) {
      const outerIdx = state.children.findIndex((node) =>
        node.children.some((topic) => topic.data.id === id),
      );
      if (outerIdx === -1) throw new Error("Could not find id in state");
      const innerIdx = state.children[outerIdx].children.findIndex(
        (node) => node.data.id === id,
      );
      const newTopic: TopicState = transform(
        state.children[outerIdx].children[innerIdx],
      );
      const newTopicNodes: TopicState[] = replace(
        state.children[outerIdx].children,
        newTopic,
        innerIdx,
      );
      const newThemeNodes: ThemeState[] = replace(
        state.children,
        { ...state.children[outerIdx], children: newTopicNodes },
        outerIdx,
      );
      return { children: newThemeNodes };
    }

    return {
      children: replace(
        state.children,
        transform(state.children[idx]) as ThemeState,
        idx,
      ),
    };
  };

const recur = <K extends TreeParams>(
  nodes: NodeTree<K>[],
  transform: TransformFunction<K>,
  id: string,
) => {
  const idx = nodes.findIndex((node) => node.data.id === id);
  if (idx !== -1) return nodes.map((node) => recur(node, transform, id));
};

// const setThemeState = (reportState: ReportState) =>
//   findAndReplace(reportState.children);

// const setTopicState = (themeState: ThemeState) =>
//   findAndReplace(themeState.children);

// const setNode = <T extends NodeState<K>, K extends {id:string}>(reportState:ReportState) => (transform:(item:T)=>T) => (id:string):ThemeState[] => {
//   const themeIdx = reportState.children.findIndex((node) => node.data.id === id)
//   if (themeIdx !== -1) return findAndReplace(reportState.children)((themeState) => themeState)(id)
//   const themeWithTopicIdx = reportState.children.findIndex((themeState) => themeState.children.some((topicState) => topicState.data.id === id))
// if (themeWithTopicIdx === -1) throw new Error("Could not find Node with data id")
//   const children = reportState.children
//   const changingTheme = children[themeWithTopicIdx]
//   return [
//     ...children.slice(0,themeWithTopicIdx),
//     {
//       ...changingTheme,
//       children: setTopicState(changingTheme)((topicState) => topicState)(id),
//     },
//     ...children.slice(themeWithTopicIdx+1)
//   ]
// }

// const setNode = (reportState:ReportState) =>

const stateBuilder = (themes: schema.Theme[]): ReportState => ({
  children: themes.map((theme) => ({
    data: theme,
    isOpen: false,
    isObserved: false,
    children: theme.topics.map((topic) => ({
      data: topic,
      isOpen: null,
      isObserved: false,
    })),
  })),
});

export const __internals = {
  identity,
  replace,
  findAndReplace,
  apply,
  guardNullIsOpen,
  guardDataMutation,
  stateBuilder,
  open,
};

// type ReportStateActionTypes = "openTheme" | "closeTheme" | "isObserved";

// type ReportStatePayload = { id: string };

// type ReportStateAction = {
//   type: ReportStateActionTypes;
//   payload: ReportStatePayload;
// };

// function reducer(state: ReportState, action: ReportStateAction):ReportState {
//   const { id } = action.payload;
//   const closeTheme = setThemeState(state)((theme) => ({
//     ...theme,
//     isOpen: false,
//   }));
//   const openTheme = setThemeState(state)((theme) => ({
//     ...theme,
//     isOpen: false,
//   }));

//   switch (action.type) {
//     case "closeTheme": {
//       return {children: closeTheme(id)};
//     }
//     case "openTheme": {
//       return {children: openTheme(id)};
//     }
//     default: {
//       return state
//     }
//   }
// }

// function useReportState(themes: schema.Theme[]) {
//   // const [] = useReducer()
// }
