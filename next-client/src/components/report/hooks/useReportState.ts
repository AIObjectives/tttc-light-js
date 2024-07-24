"use client";

import {
  ClaimNode,
  ReportState,
  SomeNode,
  ThemeNode,
  TopicNode,
} from "@src/types";
import { Dispatch, useReducer } from "react";

import * as schema from "tttc-common/schema";

const defaultThemePagination = 1;
const addThemePagination = 1;

const defaultTopicPagination = 1;
const addTopicPagination = 1;

//  ********************************
//  * UTILITY FUNCTIONS *
//  ********************************/

const identity = <T>(arg: T): T => arg;

const undefinedCheck = <T>(
  arg: T | undefined,
  errorMessage: string = "Falsy check failed",
) => {
  if (arg === undefined) {
    throw new Error(errorMessage);
  }
  return arg;
};

const replaceNode = <T extends SomeNode>(nodes: T[], node: T): T[] => {
  const idx = nodes.findIndex((_node) => _node.data.id === node.data.id);
  if (idx === -1) return nodes;
  return [...nodes.slice(0, idx), node, ...nodes.slice(idx + 1)];
};

//  ********************************
//  * HIGHER ORDER FUNCTIONS *
//  ********************************/

export type TransformationFunction<T> = (arg: T) => T;

type StateActionOnId = (state: ReportState, id: string) => ReportState;

const combineActions =
  (...funcs: StateActionOnId[]) =>
  (state: ReportState, id: string) =>
    funcs.reduce((accum, curr) => {
      return curr(accum, id);
    }, state);

const mapActions =
  (...funcs: TransformationFunction<ReportState>[]) =>
  (state: ReportState): ReportState =>
    funcs.reduce((accum, curr) => curr(accum), state);

//  ********************************
//  * THEME STATE FUNCTIONS *
//  ********************************/

// **** Base Functions ****

const findTheme = (state: ReportState, id: string): ThemeNode =>
  undefinedCheck(
    state.children.find((node) => node.data.id === id),
    "Couldn't find theme with provided Id",
  );

// **** Applicative Functions ****

const changeTheme =
  (transform: TransformationFunction<ThemeNode>) =>
  (state: ReportState, id: string): ReportState => ({
    ...state,
    children: replaceNode(state.children, transform(findTheme(state, id))),
  });

const mapTheme =
  (transform: TransformationFunction<ThemeNode>) =>
  (state: ReportState): ReportState => ({
    ...state,
    children: state.children.map(transform),
  });

// **** Transformers ****

const openTheme = changeTheme((node) => ({ ...node, isOpen: true }));

const closeTheme = changeTheme((node) => ({ ...node, isOpen: false }));

const toggleTheme = changeTheme((node) => ({ ...node, isOpen: !node.isOpen }));

const openAllThemes = mapTheme((node) => ({ ...node, isOpen: true }));

const closeAllThemes = mapTheme((node) => ({ ...node, isOpen: false }));

const resetAllThemes = mapTheme((node) => ({
  ...node,
  pagination: defaultThemePagination,
}));

const expandTheme = changeTheme((node) => ({
  ...node,
  pagination: node.pagination + addThemePagination,
}));

const setThemePagination = (num: number) =>
  changeTheme((node) => ({
    ...node,
    pagination: num,
  }));

const resetTheme = setThemePagination(defaultThemePagination);

//  ********************************
//  * TOPIC STATE FUNCTIONS *
//  ********************************/

// **** Base Functions ****

const findTopicInTheme = (
  theme: ThemeNode,
  id: string,
): TopicNode | undefined => theme.children.find((node) => node.data.id === id);

const _findTopic = (
  themeNodes: ThemeNode[],
  id: string,
): TopicNode | undefined => {
  if (themeNodes.length === 0) return undefined;
  const res = findTopicInTheme(themeNodes[0], id);
  if (!res) return _findTopic(themeNodes.slice(1), id);
  return res;
};

const findTopic = (state: ReportState, id: string): TopicNode =>
  undefinedCheck(
    _findTopic(state.children, id),
    "Could't find topic with provided Id",
  );

const _parentOfTopic = (
  themes: ThemeNode[],
  topicId: string,
): ThemeNode | undefined => {
  if (!themes.length) return undefined;
  else if (
    themes[0].children.some((node: TopicNode) => node.data.id === topicId)
  )
    return themes[0];
  return _parentOfTopic(themes.slice(1), topicId);
};

const parentOfTopic = (themes: ThemeNode[], topicId: string) =>
  undefinedCheck(
    _parentOfTopic(themes, topicId),
    "Could not find parent of topic with id provided",
  );

// **** Applicative Functions ****

const changeTopic =
  (transform: TransformationFunction<TopicNode>) =>
  (state: ReportState, id: string): ReportState => {
    const topic = findTopic(state, id);
    return {
      ...state,
      children: state.children.map((theme) => ({
        ...theme,
        children: replaceNode(theme.children, transform(topic)),
      })),
    };
  };

const mapTopic = (transform: TransformationFunction<TopicNode>) =>
  mapTheme((theme) => ({
    ...theme,
    children: theme.children.map(transform),
  }));

const mapThemeChildren =
  (transform: TransformationFunction<TopicNode>) =>
  (state: ReportState, themeId: string): ReportState =>
    mapTheme((theme) => ({
      ...theme,
      children: theme.children.map(
        theme.data.id === themeId ? transform : identity,
      ),
    }))(state);

// **** Transformers ****

const expandTopic = changeTopic((node) => ({
  ...node,
  pagination: node.pagination + addTopicPagination,
}));

const resetTopic = changeTopic((node) => ({
  ...node,
  pagination: defaultTopicPagination,
}));

const resetThemesTopics = mapThemeChildren((topic) => ({
  ...topic,
  pagination: defaultTopicPagination,
}));

const resetAllTopics = mapTopic((node) => ({
  ...node,
  pagination: defaultTopicPagination,
}));

//  ********************************
//  * STATE BUILDERS *
//  ********************************/

const stateBuilder = (themes: schema.Theme[]): ReportState => ({
  children: themes.map(makeThemeNode),
});

const makeThemeNode = (theme: schema.Theme): ThemeNode => ({
  data: theme,
  isOpen: false,
  pagination: defaultThemePagination,
  children: theme.topics.map(makeTopicNode),
});

const makeTopicNode = (topic: schema.Topic): TopicNode => ({
  data: topic,
  pagination: defaultTopicPagination,
  children: topic.claims.map(makeClaimNode),
});

const makeClaimNode = (claim: schema.Claim): ClaimNode => ({
  data: claim,
});

//  ********************************
//  * REDUCER *
//  ********************************/

type ReportStateActionTypes =
  | "open"
  | "close"
  | "openAll"
  | "closeAll"
  | "toggleTheme"
  | "expandTheme"
  | "expandTopic"
  | "focus";

type ReportStatePayload = { id: string };

export type ReportStateAction = {
  type: ReportStateActionTypes;
  payload: ReportStatePayload;
};

function reducer(state: ReportState, action: ReportStateAction): ReportState {
  const { id } = action.payload;
  switch (action.type) {
    // For open, we want the same function to work for themes or topics.
    // If topic, should open parent and set pagination to the correct value
    case "open": {
      const maybeThemeIdx = state.children.findIndex(
        (node) => node.data.id === id,
      );
      if (maybeThemeIdx !== -1) return openTheme(state, id);
      const parentTheme = parentOfTopic(state.children, id);
      const topicIdx = parentTheme.children.findIndex(
        (topic) => topic.data.id === id,
      );
      const func = combineActions(
        openTheme,
        setThemePagination(
          topicIdx + 1 > parentTheme.pagination
            ? topicIdx + 1
            : parentTheme.pagination,
        ),
      );
      return func(state, parentTheme.data.id);
    }
    case "close": {
      return combineActions(
        closeTheme,
        resetTheme,
        resetThemesTopics,
      )(state, id);
    }
    case "toggleTheme": {
      return combineActions(toggleTheme, resetTheme)(state, id);
    }
    case "openAll": {
      return openAllThemes(state);
    }
    case "closeAll": {
      return mapActions(closeAllThemes, resetAllThemes, resetAllTopics)(state);
    }
    case "expandTheme": {
      return expandTheme(state, id);
    }
    case "expandTopic": {
      return expandTopic(state, id);
    }
    case "focus": {
      // placeholder for now to trigger sideffect
      // TODO: This is a code-smell, figure out what to do.
      return state;
    }
    default: {
      return state;
    }
  }
}

function useReportState(
  themes: schema.Theme[],
): [ReportState, Dispatch<ReportStateAction>] {
  const [state, dispatch] = useReducer(reducer, stateBuilder(themes));
  return [state, dispatch];
}

export const __internals = {
  undefinedCheck,
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
  resetTheme,
  resetAllThemes,
  expandTheme,
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
  mapThemeChildren,
  resetThemesTopics,
  defaultThemePagination,
  defaultTopicPagination,
  addThemePagination,
  addTopicPagination,
};

export default useReportState;
