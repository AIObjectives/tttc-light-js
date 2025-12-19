"use client";

import { useState } from "react";
import { ToggleText } from "@/components/elements";

interface PromptToggleProps {
  title: string;
  content: string;
  isDefault: boolean;
  defaultContent?: string;
}

/**
 * Collapsible component for displaying a prompt in the report appendix.
 * Shows whether the prompt is the default or has been customized.
 * When customized, offers a "Show default" toggle for comparison.
 */
export function PromptToggle({
  title,
  content,
  isDefault,
  defaultContent,
}: PromptToggleProps) {
  const [showDefault, setShowDefault] = useState(false);

  return (
    <ToggleText>
      <ToggleText.Title>
        {title}{" "}
        <span className="text-muted-foreground text-sm font-normal">
          ({isDefault ? "default" : "customized"})
        </span>
      </ToggleText.Title>
      <ToggleText.Content>
        <div className="flex flex-col gap-2">
          <pre className="whitespace-pre-wrap font-sans text-sm">{content}</pre>
          {!isDefault && defaultContent && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowDefault(!showDefault)}
                className="text-sm text-muted-foreground underline cursor-pointer hover:text-foreground"
              >
                {showDefault ? "Hide default" : "Show default"}
              </button>
              {showDefault && (
                <div className="mt-2 p-3 bg-muted/50 rounded-md border">
                  <p className="text-xs text-muted-foreground mb-1">
                    Default prompt:
                  </p>
                  <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground">
                    {defaultContent}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </ToggleText.Content>
    </ToggleText>
  );
}
