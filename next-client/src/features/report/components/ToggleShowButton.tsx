"use client";

import { ToggleShowMoreComponentProps } from "..";

function ToggleShowMoreButton({
  children,
  subtopic,
  className,
}: ToggleShowMoreComponentProps) {
  const showMoreOnclick = (subtopicId: string) => {
    return document.getElementById(subtopicId)?.classList.toggle("showmore");
  };

  return (
    <button
      className={className}
      onClick={() => showMoreOnclick(subtopic.subtopicId!)}
    >
      {children}
    </button>
  );
}

export default ToggleShowMoreButton;
