'use client'

import React from "react"
import { Subtopic } from "src/types"
import { ToggleShowMoreComponentProps } from "./ToggleShowMoreInterface";

export default function ClientSideToggleShowMoreButton({children,subtopic, className}:ToggleShowMoreComponentProps) {

    const showMoreOnclick = (subtopicId: string) => {
        return document.getElementById(subtopicId)?.classList.toggle('showmore');
      };

    return (
        <button
          className={className}
          onClick={()=>showMoreOnclick(subtopic.subtopicId!)}
        >
          {children}
        </button>
    )
}