"use client";

import {
  Dispatch,
  Ref,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import { ReportStateAction } from "./useReportState";

type ReportActionEffectFunc = (action: ReportStateAction) => void;
type ReportActionEffect = (func: ReportActionEffectFunc) => void;

/**
 * Takes the useReportEffect and setups up scrolling behavior where certain report state actions will scroll to that node.
 */
function useScrollListener(
  useReportEffect: ReportActionEffect,
): [
  (listenForId: string) => Ref<HTMLDivElement>,
  Dispatch<SetStateAction<[string, number]>>,
] {
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
          behavior: "smooth",
        });

        // Add highlight pulse animation to indicate scroll target
        ref.current.classList.add("scroll-target-highlight");
        const element = ref.current;
        const handleAnimationEnd = () => {
          element.classList.remove("scroll-target-highlight");
          element.removeEventListener("animationend", handleAnimationEnd);
        };
        element.addEventListener("animationend", handleAnimationEnd);
      }
    }, [scrollToState]);

    return ref;
  };

  return [useScrollTo, setScrollState];
}

export default useScrollListener;
