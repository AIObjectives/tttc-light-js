"use client";

import { Button, Separator } from "@src/components/elements";
import Topic from "@src/components/topic/Topic";
import React, { useState } from "react";
import * as schema from "tttc-common/schema";

function DisplayExtendedTheme({ subtopics }: { subtopics: schema.Subtopic[] }) {
  const [show, setShow] = useState<boolean>(false);

  return show ? (
    <ExtendedTheme subtopics={subtopics} description="something" />
  ) : (
    <div>
      <Button onClick={() => setShow((curr) => !curr)}>Extend theme</Button>
    </div>
  );
}

function ExtendedTheme({
  subtopics,
  description,
}: {
  subtopics: schema.Subtopic[];
  description: string;
}) {
  return (
    <div className="gap-y-8">
      <Separator />
      <div>
        <p>{description}</p>
      </div>
      <Separator />
      {subtopics.map((subtopic) => (
        <Topic subtopic={subtopic} />
      ))}
    </div>
  );
}

export default DisplayExtendedTheme;
