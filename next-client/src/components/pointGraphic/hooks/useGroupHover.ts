"use client";

import { useState } from "react";

type HasID = { id: string };

type GroupHoverState<T extends HasID> = { isHovered: boolean; group: T };

export default function useGroupHover<T extends HasID>(
  groups: T[],
): [GroupHoverState<T>[], (id: string) => void, (id: string) => void] {
  const [state, setState] = useState<GroupHoverState<T>[]>(
    groups.map((group) => ({ group, isHovered: false })),
  );

  const onHover = (id: string) => setState((state) => _onHover(state, id));

  const onExit = (id: string) => setState((state) => _onExit(state, id));

  return [state, onHover, onExit];
}

/**
 * Find element in state and replace hover value
 */
const stateReplace = <T extends HasID>(
  state: GroupHoverState<T>[],
  idx: number,
  val: boolean,
): GroupHoverState<T>[] => [
  ...state.slice(0, idx),
  { ...state[idx], isHovered: val },
  ...state.slice(idx + 1),
];

/**
 * Find idx or throw an error if missing
 */
const safeFindIdx = <T extends HasID>(
  state: GroupHoverState<T>[],
  id: string,
): number => {
  const idx = state.findIndex((val) => val.group.id === id);
  if (idx === -1) throw new Error("could not find idx to in topicHoverReducer");
  return idx;
};

/**
 *
 */
const curryFindAndReplace =
  (value: boolean) =>
  <T extends HasID>(
    state: GroupHoverState<T>[],
    id: string,
  ): GroupHoverState<T>[] =>
    stateReplace(state, safeFindIdx(state, id), value);

/**
 * on hover, turn hover state on
 */
const _onHover = curryFindAndReplace(true);

/**
 * on exit, turn hover state off
 */
const _onExit = curryFindAndReplace(false);
