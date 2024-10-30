"use client";

import React, { useState } from "react";
import { cn } from "@src/lib/utils/shadcn";

export function ExpandableText(
  props: React.HTMLAttributes<HTMLParagraphElement>,
) {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <div>
      <p
        {...props}
        className={cn(props.className, `${isOpen ? "" : "line-clamp-2"}`)}
      >
        {props.children}{" "}
      </p>
      {
        <span
          onClick={() => setIsOpen((state) => !state)}
          className={cn(props.className, "underline cursor-pointer")}
        >
          {isOpen ? "Show less" : "Read more"}
        </span>
      }
    </div>
  );
}
