"use client";

import {
  type Dispatch,
  type Ref,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReportStateAction } from "./useReportState";

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
    // biome-ignore lint/correctness/useExhaustiveDependencies: scrollToState from outer closure is intentional - effect must re-run when scroll target changes
    useEffect(() => {
      const [currId] = scrollToState;
      const element = ref.current;

      if (listenForId !== currId || !element) {
        return;
      }

      // Scroll to position the element's top near the top of the viewport.
      // Use an offset to account for the fixed navbar (64px) plus some padding.
      const NAVBAR_OFFSET = 80;
      const y =
        element.getBoundingClientRect().top + window.scrollY - NAVBAR_OFFSET;
      window.scroll({
        top: y,
        behavior: "smooth",
      });

      // Add highlight pulse animation to indicate scroll target
      element.classList.add("scroll-target-highlight");
      const handleAnimationEnd = () => {
        element.classList.remove("scroll-target-highlight");
        element.removeEventListener("animationend", handleAnimationEnd);
      };
      element.addEventListener("animationend", handleAnimationEnd);

      // Cleanup: remove listener if component unmounts during animation
      return () => {
        element.removeEventListener("animationend", handleAnimationEnd);
        element.classList.remove("scroll-target-highlight");
      };
    }, [listenForId, scrollToState]);

    return ref;
  };

  return [useScrollTo, setScrollState];
}

export default useScrollListener;
