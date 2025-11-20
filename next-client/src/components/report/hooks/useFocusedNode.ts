"use client";

import { RefObject, useEffect, useState } from "react";
import { useIsVisible } from "@/lib/hooks/useIsVisible";
import useWindowDimensions from "@/lib/hooks/useWindowDimensions";

/**
 * Summary
 *
 * Basic idea is that we want to know what node is in the middle of the screen in order for the outline to highlight it.
 * This works by using an intersection observer that adds the component's ref to state. Then, there's an event listener that runs when the user scrolls and measures the distance from the center for each ref.
 */

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
  nodeRefs
    .map((nodeRef) => {
      const ref = nodeRef[1];
      const boundedRect = ref.current?.getBoundingClientRect();
      // Skip refs that aren't attached to DOM elements (e.g., hidden tabs)
      if (!boundedRect) {
        // Log in development to help debug missing refs
        if (process.env.NODE_ENV === "development") {
          console.debug(
            "[focus-tracking] Skipping node with no bounding rect",
            {
              nodeId: nodeRef[0],
              refAttached: !!ref.current,
              reason: "no bounding rect - likely hidden tab or unmounted",
            },
          );
        }
        return null;
      }
      const pos: Position = {
        top: boundedRect.top,
        bottom: boundedRect.bottom,
      };
      const dis = distanceFromBoundary(pos, boundary);
      return [nodeRef[0], dis] as NodeDistance;
    })
    .filter((distance): distance is NodeDistance => distance !== null);

//  ********************************
//  * useFocusNode *
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
      if (isObserved && !ignore) {
        addNodeRef([id, observedRef]);
      } else {
        removeNodeRef(id);
      }
    }, [isObserved, ignore]);

    return observedRef;
  };
}
