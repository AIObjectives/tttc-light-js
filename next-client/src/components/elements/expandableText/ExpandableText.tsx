"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/shadcn";

export function ExpandableText(
  props: React.HTMLAttributes<HTMLParagraphElement>,
) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const pRef = useRef<HTMLParagraphElement>(null);
  const [showButton, setShowButton] = useState(true);

  useEffect(() => {
    if (!pRef.current) return;

    const biggerThanTwoLines =
      pRef.current.scrollHeight > pRef.current.clientHeight;
    setShowButton(biggerThanTwoLines);
  }, [pRef.current]);

  return (
    <div>
      <p
        ref={pRef}
        {...props}
        className={cn(props.className, `${isOpen ? "" : "line-clamp-2"}`)}
      >
        {props.children}{" "}
      </p>
      {showButton ? (
        <button
          type="button"
          onClick={() => setIsOpen((state) => !state)}
          className={cn(props.className, "underline cursor-pointer")}
          aria-expanded={isOpen}
        >
          {isOpen ? "Show less" : "Read more"}
        </button>
      ) : null}
    </div>
  );
}
