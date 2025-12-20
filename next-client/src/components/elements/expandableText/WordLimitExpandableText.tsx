"use client";

import { useMemo, useState } from "react";

interface Props {
  text: string;
  wordLimit?: number;
  className?: string;
}

export function WordLimitExpandableText({
  text,
  wordLimit = 180,
  className,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { truncatedText, needsTruncation } = useMemo(() => {
    const words = text.split(/\s+/).filter(Boolean); // filter empty strings
    if (words.length <= wordLimit) {
      return { truncatedText: text, needsTruncation: false };
    }
    return {
      truncatedText: `${words.slice(0, wordLimit).join(" ")}...`,
      needsTruncation: true,
    };
  }, [text, wordLimit]);

  return (
    <p className={className}>
      {isExpanded ? text : truncatedText}{" "}
      {needsTruncation && (
        <button
          type="button"
          onClick={() => setIsExpanded((state) => !state)}
          className="text-muted-foreground cursor-pointer text-sm"
          aria-expanded={isExpanded}
        >
          {isExpanded ? "Show less" : "Show more"}
        </button>
      )}
    </p>
  );
}
