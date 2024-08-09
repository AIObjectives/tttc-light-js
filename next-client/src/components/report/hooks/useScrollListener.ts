"use client";

import { Dispatch, Ref, useEffect, useRef, useState } from "react";
import { ReportStateAction } from "./useReportState";

type ReportActionEffectFunc = (action: ReportStateAction) => void;
type ReportActionEffect = (func: ReportActionEffectFunc) => void;

function useScrollListener(
  useReportEffect: ReportActionEffect,
): [(listenForId: string) => Ref<HTMLDivElement>] {
  const [scrollToState, setScrollState] = useState<[string, number]>([
    "",
    Date.now(),
  ]);

  useReportEffect((action: ReportStateAction) => {
    if (action.type === "open") {
      setScrollState([action.payload.id, Date.now()]);
    }
  });

  const useScrollTo = (listenForId: string) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const [currId] = scrollToState;
      console.log(currId);

      if (listenForId === currId && ref.current) {
        const y =
          ref.current?.getBoundingClientRect().top +
          window.scrollY -
          window.innerHeight / 4;
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
