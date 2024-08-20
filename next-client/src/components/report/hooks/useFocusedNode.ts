"use client";

import { RefObject, useEffect, useState } from "react";
import { useIsVisible } from "@src/lib/hooks/useIsVisible";
import useWindowDimensions from "@src/lib/hooks/useWindowDimensions";

//  ********************************
//  * TYPES *
//  ********************************/

// Position of Node
type Position = {
  top: number;
  bottom: number;
};

// Tuple with node's id and ref
type NodeRef = [string, RefObject<HTMLDivElement>];

// Tuple with node's id and distance
type NodeDistance = [string, number];

// Type of functional hook that's returned to be consumed by components
type ReturnHook = (id: string, _ignore?: boolean) => RefObject<HTMLDivElement>;

//  ********************************
//  * HELPER FUNCTIONS *
//  ********************************/

// Computes distance of node from boundary
const distanceFromBoundary = (pos: Position, boundary: number): number => {
  if (pos.top <= boundary && pos.bottom >= boundary) return 0;
  else
    return Math.min(
      Math.abs(pos.top - boundary),
      Math.abs(pos.bottom - boundary),
    );
};

// Takes a list of nodes with their distances and returns the closest one. Returns null if list is empty.
const closestNode = (distances: NodeDistance[]): NodeDistance | null =>
  distances.length
    ? distances.reduce((a, b) => (a[1] < b[1] ? a : b), distances[0])
    : null;

// Goes through a list of NodeRefs and finds each components distances
const getNodeDistances = (
  nodeRefs: NodeRef[],
  boundary: number,
): NodeDistance[] =>
  nodeRefs.map((nodeRef) => {
    const ref = nodeRef[1];
    const boundedRect = ref.current?.getBoundingClientRect();
    if (boundedRect === undefined)
      throw new Error("Bounded Rect should not be null in useFocusedNode");
    const pos: Position = {
      top: boundedRect.top,
      bottom: boundedRect.bottom,
    };
    const dis = distanceFromBoundary(pos, boundary);
    return [nodeRef[0], dis];
  });

//  ********************************
//  * HOOK *
//  ********************************/

/**
 * Keeps track of all the nodes that are on the screen and calls some function with that node's id
 * This hook should be used at the top level of the report. Returns a hook that should be passed to its nodes.
 */
export function useFocusedNode(action: (id: string) => void): ReturnHook {
  // get window dimensions
  const { height: windowHeight } = useWindowDimensions();

  // boundary is the point where we want a node be to "in focus"
  const boundary = windowHeight / 2;

  // State with all the nodes on the screen. Should have their id and the div's ref.
  const [nodeRefs, setNodeRefs] = useState<NodeRef[]>([]);

  // Add node to state
  const addNodeRef = (nodeRef: NodeRef) =>
    setNodeRefs((curr) => [...curr, nodeRef]);

  // Remove node from state
  const removeNodeRef = (id: string) =>
    setNodeRefs((curr) => curr.filter((ref) => ref[0] !== id));

  // When the user scrolls, we want to get the distances of all the refs and highlight the correct component
  const scrollListener = (nodeRefs: NodeRef[], boundary: number) => {
    const distances = getNodeDistances(nodeRefs, boundary);
    const closest = closestNode(distances);
    if (closest === null) return;
    action(closest[0]);
  };

  // Manages scroll listeners
  useEffect(() => {
    const listener = () => scrollListener(nodeRefs, boundary);
    document.addEventListener("scroll", listener);
    return () => document.removeEventListener("scroll", listener);
  }, [nodeRefs.length]);

  /**
   * Returns a hook that components can use to add themselves to the nodeRefs state
   */
  return (id: string, _ignore?: boolean) => {
    const ignore = _ignore || false;
    const [observedRef, isObserved] = useIsVisible();

    useEffect(() => {
      console.log(id, isObserved);
      if (isObserved && !ignore) {
        addNodeRef([id, observedRef]);
      } else {
        removeNodeRef(id);
      }
    }, [isObserved, ignore]);

    return observedRef;
  };
}
