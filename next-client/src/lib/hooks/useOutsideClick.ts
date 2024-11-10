"use client";
import { RefObject, useEffect } from "react";

function useOutsideClick(ref: RefObject<HTMLElement>, callBack: () => void) {
  useEffect(() => {
    // ! Code works, but TypeScript is throwing a type error here. Can't figure out the right event type. But it does work.
    const handleOutsideClick = (event: MouseEvent) =>
      // @ts-ignore
      ref.current !== null && !ref.current.contains(event.target)
        ? callBack()
        : undefined;

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [ref, callBack]);
}

export default useOutsideClick;
