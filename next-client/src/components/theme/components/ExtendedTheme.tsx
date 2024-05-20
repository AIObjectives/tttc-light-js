"use client";

import { Button, Separator } from "@src/components/elements";
import { Col } from "@src/components/layout";
import Topic from "@src/components/topic/Topic";
import React, { useState } from "react";
import * as schema from "tttc-common/schema";

function DisplayExtendedTheme({ subtopics }: { subtopics: schema.Subtopic[] }) {
  const [show, setShow] = useState<boolean>(false);

  return show ? (
    <ExtendedTheme
      onClose={() => setShow(false)}
      subtopics={subtopics}
      description="something"
    />
  ) : (
    <div>
      <Button onClick={() => setShow(true)}>Extend theme</Button>
    </div>
  );
}

function ExtendedTheme({
  subtopics,
  description,
  onClose,
}: {
  subtopics: schema.Subtopic[];
  description: string;
  onClose: () => void;
}) {
  return (
    <Col gap={8}>
      <div>
        <Button onClick={onClose}>Collapse Theme</Button>
      </div>
      <Separator />
      <Description description={description} />
      <Separator />
      <SubtopicMap subtopics={subtopics} />
    </Col>
  );
}

function Description({ description }: { description: string }) {
  return <p>{description}</p>;
}

function SubtopicMap({ subtopics }: { subtopics: schema.Subtopic[] }) {
  return subtopics.map((subtopic, i) => (
    <>
      <Topic subtopic={subtopic} />
      {i !== subtopics.length - 1 ? <Separator /> : null}
    </>
  ));
}

export default DisplayExtendedTheme;
