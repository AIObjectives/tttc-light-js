"use client";

import { Dispatch, useReducer } from "react";
import { getNPeople } from "tttc-common/morphisms";

import * as schema from "tttc-common/schema";

import {
  Option,
  pipe,
  Array,
  Either,
  Effect,
  Queue,
  flow,
  Match,
} from "effect";
import { Arya } from "next/font/google";
import { compose } from "effect/Function";

const defaultTopicPagination = 3;
const addTopicPagination = 1;

const defaultSubtopicPagination = 3;
const addSubtopicPagination = 3;

//  ********************************
//  * TYPE DEFINITIONS
//  ********************************/

/**
 * All Node.data should have an id for easy lookup
 */
export type HasId = { id: string };

/**
 * Type for nodes that have a child
 */
export type HasChildren<T extends SomeNode> = { children: T[] };

/**
 * A single Node in the NodeTree. Wraps data.
 */
export type Node<T extends HasId> = {
  id: string;
  data: Readonly<T>;
};

/**
 * Report State - highest level implementation
 */
export type ReportState = {
  children: TopicNode[];
  focusedId: string | null;
};

/**
 * Nodes with Topics as data
 */
export type TopicNode = Node<schema.Topic> & {
  children: SubtopicNode[];
  isOpen: boolean;
  pagination: number;
};

/**
 * Nodes with Subtopic as data
 */
export type SubtopicNode = Node<schema.Subtopic> & {
  children: ClaimNode[];
  pagination: number;
};

/**
 * Nodes with Claims as data
 */
export type ClaimNode = Node<schema.Claim>;

/**
 * Union of all nodes
 */
export type SomeNode = TopicNode | SubtopicNode | ClaimNode;

// //  ********************************
// //  * UTILITY FUNCTIONS *
// //  ********************************/

// const identity = <T>(arg: T): T => arg;

// const undefinedCheck = <T>(
//   arg: T | undefined,
//   errorMessage: string = "Falsy check failed",
// ) => {
//   if (arg === undefined) {
//     throw new Error(errorMessage);
//   }
//   return arg;
// };

// /**
//  * Finds and replaces a node with the same id
//  */
// const replaceNode = <T extends SomeNode>(nodes: T[], node: T): T[] => {
//   const idx = nodes.findIndex((_node) => _node.data.id === node.data.id);
//   if (idx === -1) return nodes;
//   return [...nodes.slice(0, idx), node, ...nodes.slice(idx + 1)];
// };

// //  ********************************
// //  * HIGHER ORDER FUNCTIONS *
// //  ********************************/

// /**
//  * Function type for a generic transformer - takes some T and returns T with changes.
//  */
// export type TransformationFunction<T> = (arg: T) => T;

// /**
//  * Function type that takes state and id, and returns state
//  */
// type StateActionOnId = (state: ReportState, id: string) => ReportState;

// /**
//  * HOC - Takes some number of functions (StateActionOnId) and composes them
//  */
// const combineActions =
//   (...funcs: StateActionOnId[]) =>
//   (state: ReportState, id: string) =>
//     funcs.reduce((accum, curr) => {
//       return curr(accum, id);
//     }, state);

// /**
//  * HOC - Takes some number of function (only takes State) and composes them
//  */
// // const mapActions =
// //   (...funcs: TransformationFunction<ReportState>[]) =>
// //   (state: ReportState): ReportState =>
// //     funcs.reduce((accum, curr) => curr(accum), state);

// //  ********************************
// //  * THEME STATE FUNCTIONS *
// //  ********************************/

// // **** Base Functions ****

// /**
//  * Finds TopicNode by id
//  */
// const findTopic = (state: ReportState, id: string): TopicNode =>
//   undefinedCheck(
//     state.children.find((node) => node.data.id === id),
//     "Couldn't find topic with provided Id",
//   );

// // **** Applicative Functions ****

// /**
//  * HOC - Creates functions that find and transform topics. Takes a transformer function.
//  * Returns (state,id)=>state
//  */
// const changeTopic =
//   (transform: TransformationFunction<TopicNode>): StateActionOnId =>
//   (state, id) => ({
//     ...state,
//     children: replaceNode(state.children, transform(findTopic(state, id))),
//   });

// /**
//  * HOC - Creates functions that map to topic nodes
//  */
// const mapTopic =
//   (transform: TransformationFunction<TopicNode>) =>
//   (state: ReportState): ReportState => ({
//     ...state,
//     children: state.children.map(transform),
//   });

// // **** Transformers ****

// const openTopic = changeTopic((node) => ({ ...node, isOpen: true }));

// const closeTopic = changeTopic((node) => ({ ...node, isOpen: false }));

// const toggleTopic = changeTopic((node) => ({ ...node, isOpen: !node.isOpen }));

// const openAllTopics = mapTopic((node) => ({ ...node, isOpen: true }));

// const closeAllTopics = mapTopic((node) => ({ ...node, isOpen: false }));

// const resetAllTopics = mapTopic((node) => ({
//   ...node,
//   pagination: Math.min(node.children.length, defaultTopicPagination),
// }));

// const expandTopic = changeTopic((node) => ({
//   ...node,
//   pagination: Math.min(
//     node.children.length,
//     node.pagination + addTopicPagination,
//   ),
// }));

// const setTopicPagination = (num: number) =>
//   changeTopic((node) => ({
//     ...node,
//     pagination: Math.min(
//       node.children.length,
//       Math.max(num, defaultTopicPagination),
//     ),
//   }));

// const resetTopic = setTopicPagination(defaultTopicPagination);

// //  ********************************
// //  * SUBTOPIC STATE FUNCTIONS *
// //  ********************************/

// // **** Base Functions ****

// /**
//  * Searches a TopicNode for a SubtopicNode
//  */
// const findSubtopicInTopic = (
//   topic: TopicNode,
//   id: string,
// ): SubtopicNode | undefined =>
//   topic.children.find((node) => node.data.id === id);

// /**
//  * Find SubtopicNode from State
//  */
// const findSubtopic = (state: ReportState, id: string): SubtopicNode =>
//   undefinedCheck(
//     _findSubtopic(state.children, id),
//     "Could't find topic with provided Id",
//   );

// const _findSubtopic = (
//   TopicNodes: TopicNode[],
//   id: string,
// ): SubtopicNode | undefined => {
//   if (TopicNodes.length === 0) return undefined;
//   const res = findSubtopicInTopic(TopicNodes[0], id);
//   if (!res) return _findSubtopic(TopicNodes.slice(1), id);
//   return res;
// };

// /**
//  * Find the parent node of a SubtopicNode
//  */
// const parentOfSubtopic = (topics: TopicNode[], subtopicId: string) =>
//   undefinedCheck(
//     _parentOfSubtopic(topics, subtopicId),
//     "Could not find parent of subtopic with id provided",
//   );

// const _parentOfSubtopic = (
//   topics: TopicNode[],
//   subtopicId: string,
// ): TopicNode | undefined => {
//   if (!topics.length) return undefined;
//   else if (
//     topics[0].children.some((node: SubtopicNode) => node.data.id === subtopicId)
//   )
//     return topics[0];
//   return _parentOfSubtopic(topics.slice(1), subtopicId);
// };

// // **** Applicative Functions ****

// /**
//  * HOC - Creates functions that find and transform SubtopicNodes
//  */
// const changeSubtopic =
//   (transform: TransformationFunction<SubtopicNode>) =>
//   (state: ReportState, id: string): ReportState => {
//     const subtopic = findSubtopic(state, id);
//     return {
//       ...state,
//       children: state.children.map((topic) => ({
//         ...topic,
//         children: replaceNode(topic.children, transform(subtopic)),
//       })),
//     };
//   };

// /**
//  * HOC - Creates functions that map to all SubtopicNodes
//  */
// const mapSubtopic = (transform: TransformationFunction<SubtopicNode>) =>
//   mapTopic((topic) => ({
//     ...topic,
//     children: topic.children.map(transform),
//   }));

// /**
//  * HOC - Creates functions that maps to a specific TopicNode's children. So the transformer applies to only that TopicNode's children.
//  */
// const mapTopicChildren =
//   (transform: TransformationFunction<SubtopicNode>) =>
//   (state: ReportState, topicId: string): ReportState =>
//     mapTopic((topic) => ({
//       ...topic,
//       children: topic.children.map(
//         topic.data.id === topicId ? transform : identity,
//       ),
//     }))(state);

// // **** Transformers ****

// const expandSubtopic = changeSubtopic((node) => ({
//   ...node,
//   pagination: Math.min(
//     node.children.length,
//     node.pagination + addSubtopicPagination,
//   ),
// }));

// const setSubtopicPagination = (num: number) =>
//   changeSubtopic((node) => ({
//     ...node,
//     pagination: Math.min(
//       node.children.length,
//       Math.max(num, defaultSubtopicPagination),
//     ),
//   }));

// // const resetSubtopic = changeSubtopic((node) => ({
// //   ...node,
// //   pagination: Math.min(defaultSubtopicPagination, node.children.length),
// // }));

// const resetTopicsChildren = mapTopicChildren((node) => ({
//   ...node,
//   pagination: Math.min(defaultSubtopicPagination, node.children.length),
// }));

// const resetAllSubtopics = mapSubtopic((node) => ({
//   ...node,
//   pagination: Math.min(defaultSubtopicPagination, node.children.length),
// }));

// const setFocusedId = (state: ReportState, focusedId: string): ReportState => ({
//   ...state,
//   focusedId,
// });

// //  ********************************
// //  * UNTESTED *
// //  ********************************/

// const _parentOfClaim = (state: ReportState, id: string) =>
//   state.children
//     .flatMap((topic) => topic.children)
//     .find((sub) => sub.children.find((clm) => clm.data.id === id));

// const parentOfClaim = (state: ReportState, id: string): SubtopicNode =>
//   undefinedCheck(_parentOfClaim(state, id), "Could not find claim by id");

// const openToNode = (state: ReportState, id: string): ReportState => {
//   if (state.children.some((node) => node.data.id === id))
//     return openTopic(state, id);
//   const maybeTopicIdx = state.children.findIndex((node) =>
//     node.children.some((node) => node.data.id === id),
//   );
//   if (maybeTopicIdx !== -1) {
//     const topic = state.children[maybeTopicIdx];
//     const subtopicIdx = topic.children.findIndex((node) => node.data.id === id);
//     return combineActions(openTopic, setTopicPagination(subtopicIdx + 1))(
//       state,
//       topic.data.id,
//     );
//   } else {
//     const subtopicWithClaim = parentOfClaim(state, id);
//     const parentTopic = parentOfSubtopic(
//       state.children,
//       subtopicWithClaim.data.id,
//     );
//     const subtopicIdx = parentTopic.children.findIndex(
//       (node) => node.data.id === subtopicWithClaim.data.id,
//     );
//     const claimIdx = subtopicWithClaim.children.findIndex(
//       (clm) => clm.data.id === id,
//     );
//     const pagState = setSubtopicPagination(claimIdx + 1)(
//       state,
//       subtopicWithClaim.data.id,
//     );
//     return combineActions(openTopic, setTopicPagination(subtopicIdx + 1))(
//       pagState,
//       parentTopic.data.id,
//     );
//   }
// };

//  ********************************
//  * STATE BUILDERS *
//  ********************************/

const stateBuilder = (topics: schema.Topic[]): ReportState => ({
  children: topics
    .map(makeTopicNode)
    .sort(
      (a, b) =>
        getNumberOfPeopleFromTopic(b.data) - getNumberOfPeopleFromTopic(a.data),
    ),
  focusedId: null,
});

const makeTopicNode = (topic: schema.Topic): TopicNode => ({
  id: topic.id,
  data: topic,
  isOpen: false,
  pagination: Math.min(topic.subtopics.length, defaultTopicPagination),
  children: topic.subtopics
    .map(makeSubSubtopicNode)
    .sort(
      (a, b) =>
        getNumberOfPeopleFromSubTopic(b.data) -
        getNumberOfPeopleFromSubTopic(a.data),
    ),
});

const makeSubSubtopicNode = (subtopic: schema.Subtopic): SubtopicNode => ({
  id: subtopic.id,
  data: subtopic,
  pagination: Math.min(subtopic.claims.length, defaultSubtopicPagination),
  children: subtopic.claims.map(makeClaimNode),
});

const makeClaimNode = (claim: schema.Claim): ClaimNode => ({
  id: claim.id,
  data: claim,
});

// const getNumberOfClaimsFromTopic = (topic: schema.Topic): number =>
//   topic.subtopics.flatMap((sub) => sub.claims).length;
// const getNumberOfClaimsFromSubtopic = (subtopic: schema.Subtopic): number =>
//   subtopic.claims.length;

const getNumberOfPeopleFromTopic = (topic: schema.Topic) =>
  getNPeople(topic.subtopics);

const getNumberOfPeopleFromSubTopic = (subtopic: schema.Subtopic) =>
  getNPeople(subtopic.claims);

//  ********************************
//  * Open *
//  ********************************/

const setNodeOpen = <T extends TopicNode | SubtopicNode>(node: T): T => ({
  ...node,
  isOpen: true,
});

const findNodeIdx = <T extends SomeNode>(
  nodes: T[],
  nodeId: string,
): Option.Option<number> =>
  Array.findFirstIndex(nodes, (n) => n.data.id === nodeId);

/**
 * Recursive function that finds any node in the tree based on its nodeId and returns a path to it
 *
 * TODO: Rewrite this to use breadth first search? Seems like that would be slightly faster in our case.
 * TODO: See if we can exit early instead of traversing the entire tree.
 */
const findNodePath = (state: ReportState, nodeId: string) => {
  // a recursive function
  const go = (
    nodes: SomeNode[],
    nodeId: string,
    path: number[] = [],
  ): Option.Option<number[]> => {
    return pipe(
      // see if node is in this set of nodes
      findNodeIdx(nodes, nodeId),
      // either:
      Option.match({
        // if it wasn't found
        onNone: () =>
          // recursively go through its children if any
          nodes.reduce((found, node, i) => {
            if (Option.isNone(found) && "children" in node) {
              return go(node.children, nodeId, [...path, i]);
            } else {
              return found;
            }
          }, Option.none()),
        // if found, return the path
        onSome: (idx) => {
          return Option.some([...path, idx]);
        },
      }),
    );
  };
  // calls recursive
  return go(state.children, nodeId);
};

// const applySubtopic = (
//   nodes: TopicNode[],
//   f: (node: SubtopicNode) => SubtopicNode,
//   path: [number, number],
// ) =>
//   Array.modify(nodes, path[0], (topic: TopicNode) => ({
//     ...topic,
//     children: Array.modify(topic.children, path[1], f),
//   }));

// const applyClaim = (
//   nodes: TopicNode[],
//   f: (node: ClaimNode) => ClaimNode,
//   path: [number, number, number],
// ) =>
//   Array.modify(nodes, path[0], (topic: TopicNode) => ({
//     ...topic,
//     children: Array.modify(topic.children, path[1], (sub: SubtopicNode) => ({
//       ...sub,
//       children: Array.modify(sub.children, path[2], f),
//     })),
//   }));

const getPath = <T>(arr: T[], idx: number) =>
  pipe(
    Array.get(arr, idx),
    Either.fromOption(() => `Path index did not work: ${idx}`),
  );

const applyTopic =
  (f: (node: TopicNode) => TopicNode) =>
  (nodes: TopicNode[], path: [number]): Either.Either<TopicNode[], string> =>
    pipe(
      getPath(nodes, path[0]),
      Either.map((node) => Array.replace(nodes, path[0], f(node))),
    );

const applySubtopic =
  (f: (node: SubtopicNode) => SubtopicNode) =>
  (
    nodes: TopicNode[],
    path: [number, number],
  ): Either.Either<TopicNode[], string> =>
    pipe(
      // First get the topic
      getPath(nodes, path[0]),
      // Then try to get and modify the child
      Either.flatMap((topic) =>
        pipe(
          getPath(topic.children, path[1]),
          Either.map((subtopic) => ({
            ...topic,
            children: Array.replace(topic.children, path[1], f(subtopic)),
          })),
        ),
      ),
      // Finally modify the original array if everything succeeded
      Either.map((newTopic) => Array.replace(nodes, path[0], newTopic)),
    );

const _openTopic = () => applyTopic(setNodeOpen);

const openSubtopic = () => applySubtopic(setNodeOpen);

const matchPathToAction =
  (action: {
    topic: (node: TopicNode) => TopicNode;
    subtopic: (node: SubtopicNode) => SubtopicNode;
  }) =>
  (path: number[]) =>
    Match.value<number[]>(path).pipe(
      Match.when(
        (arg) => arg.length === 1,
        () => action.topic,
      ),
      Match.when(
        (arg) => arg.length === 2,
        () => action.subtopic,
      ),
      Match.option,
    );

const openAction = matchPathToAction({
  topic: setNodeOpen,
  subtopic: setNodeOpen,
});

const openNode = (state: ReportState, nodeId: string) =>
  pipe(
    findNodePath(state, nodeId),
    Option.flatMap((path) => pipe(path, openAction)),
  );

// type ModifyTopicAction = {
//   type: "topic"
//   path:[number],
//   f: (node:TopicNode) => TopicNode
// }

// type ModfifySubtopicAction = {
//   type: "subtopic"
//   path: [number, number],
//   f: (node:SubtopicNode)=> SubtopicNode
// }

// const applyFtoState = (state:ReportState, action: ModifyTopicAction | ModfifySubtopicAction):Either.Either<ReportState, string> => {
//   switch(action.type) {
//     case 'topic': {
//       return Either.map(
//         applyTopic(state.children, action.f, action.path),
//         children => ({...state, children})
//       )
//     };
//     case 'subtopic': {
//       return Either.map(
//         applySubtopic(state.children, action.f, action.path),
//         children => ({...state, children})
//       )
//     };
//     default: {
//       return Either.left("Invalid action")
//     }
//   }
// }

// const constructAction = (path:number, f:())

// const newOpen = (state:ReportState, nodeId:string) => pipe(
//   findNodePath(state, nodeId),
//   // Option.match({
//   //   onNone: ()=> Either.left("Could not find path to nodeId"),
//   //   onSome: (path) => Either.right(path)
//   // }),
//   Either.fromOption(()=> "Could not find number"),
//   Either.flatMap(
//     path => {
//       switch(path.length) {
//         case 1: return Either.right({type: "topic", path, f: setNodeOpen});
//         case 2: return Either.right({type: "subtopic", path, f: setNodeOpen});
//         default: return Either.left("Invalid path")
//       }
//     }
//   ),
//   Either.map(
//     action => applyFtoState(state, action)
//   )

// )

/**
 * Opens topic
 */
const openTopic = (state: ReportState, nodeId: string) =>
  pipe(
    findNodeIdx(state.children, nodeId),
    Option.match({
      onNone: () => Either.left(`Could not find topic with id ${nodeId}`),
      onSome: (idx) =>
        Either.right({
          ...state,
          children: Array.modify(state.children, idx, setNodeOpen),
        }),
    }),
  );

const openToSubtopic = (state: ReportState, nodeId: string) => pipe(state);

const open = (state: ReportState, nodeId: string): ReportState =>
  pipe(
    state,
    (state) => openTopic(state, nodeId),
    Either.match({
      onLeft: () => state,
      onRight: (newState) => newState,
    }),
  );

//  ********************************
//  * REDUCER *
//  ********************************/

/**
 * Actions
 *
 * Open:
 *  If node is topic, just set to open
 *  If node is subtopic, set parent topic to open, set topic pagination if needed
 *  If node is claim, set parent topic to open, set topic and subtopic pagination if needed
 */

type ReportStateActionTypes =
  | "open"
  | "close"
  | "openAll"
  | "closeAll"
  | "toggleTopic"
  | "expandTopic"
  | "expandSubtopic"
  | "focus";

type ReportStatePayload = { id: string };

export type ReportStateAction = {
  type: ReportStateActionTypes;
  payload: ReportStatePayload;
};

function reducer(state: ReportState, action: ReportStateAction): ReportState {
  const { id } = action.payload;
  switch (action.type) {
    // For open, we want the same function to work for topics or subtopics.
    // If subtopic, should open parent and set pagination to the correct value
    case "open": {
      // return openToNode(state, id);
      return open(state, action.payload.id);
    }
    // case "close": {
    //   return combineActions(
    //     closeTopic,
    //     resetTopic,
    //     resetTopicsChildren,
    //   )(state, id);
    // }
    // case "toggleTopic": {
    //   return combineActions(toggleTopic, resetTopic)(state, id);
    // }
    // case "openAll": {
    //   return openAllTopics(state);
    // }
    // case "closeAll": {
    //   return pipe(state, closeAllTopics, resetAllTopics, resetAllSubtopics);
    // }
    // case "expandTopic": {
    //   return expandTopic(state, id);
    // }
    // case "expandSubtopic": {
    //   return expandSubtopic(state, id);
    // }
    // case "focus": {
    //   return setFocusedId(state, id);
    // }
    default: {
      return state;
    }
  }
}

function useReportState(
  topics: schema.Topic[],
): [ReportState, Dispatch<ReportStateAction>] {
  const [state, dispatch] = useReducer(reducer, stateBuilder(topics));
  return [state, dispatch];
}

export const __internals = {
  //   undefinedCheck,
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
  //   resetTopic,
  //   resetAllTopics,
  //   expandTopic,
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
  //   mapTopicChildren,
  //   resetTopicsChildren,
  defaultTopicPagination,
  defaultSubtopicPagination,
  findNodePath,
  //   addTopicPagination,
  //   addSubtopicPagination,
};

export default useReportState;
