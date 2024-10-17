"use client";

import { Ref, useEffect, useRef, useState } from "react";
import { ReportStateAction } from "./useReportState";

type ReportActionEffectFunc = (action: ReportStateAction) => void;
type ReportActionEffect = (func: ReportActionEffectFunc) => void;

/**
 * Takes the useReportEffect and setups up scrolling behavior where certain report state actions will scroll to that node.
 */
function useScrollListener(
  useReportEffect: ReportActionEffect,
): [(listenForId: string) => Ref<HTMLDivElement>] {
  // Id and timestamp for what component to scroll to. Timestamp is included so clicking on same node multiple times works.
  const [scrollToState, setScrollState] = useState<[string, number]>([
    "",
    Date.now(),
  ]);

  // When "open" dispatch is triggered, set the scrollState
  useReportEffect((action: ReportStateAction) => {
    if (action.type === "open") {
      setScrollState([action.payload.id, Date.now()]);
    }
  });

  // Hook that's returned and passed to other nodes
  const useScrollTo = (listenForId: string) => {
    const ref = useRef<HTMLDivElement>(null);

    // When scrollState changes, see if new state is this node's id. If so, scroll to it.
    useEffect(() => {
      const [currId] = scrollToState;

      if (listenForId === currId && ref.current) {
        // Don't scroll directly to node. Instead, make it go to middle of screen.
        const y =
          ref.current?.getBoundingClientRect().top + window.scrollY - 50;
        window.scroll({
          top: y,
        });
      }
    }, [scrollToState]);

    return ref;
  };

  return [useScrollTo];
}

export default useScrollListener;
