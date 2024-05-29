"use client";
import { Card, CardContent, Button, Separator } from "@src/components/elements";
import React, { useState } from "react";
import * as schema from "tttc-common/schema";
import { Col } from "@src/components/layout";
import Topic from "@src/components/topic/Topic";

function ThemeWrapper({
  children,
  subtopics,
  description,
}: React.PropsWithChildren<{
  subtopics: schema.Subtopic[];
  description: string;
}>) {
  const [show, setShow] = useState<boolean>(false);
  return (
    <Card>
      <CardContent>
        <Col gap={3}>
          {children}
          <div>
            <Button onClick={() => setShow((val) => !val)}>
              {show ? "Collapse Theme" : "Extend Theme"}
            </Button>
          </div>
        </Col>
      </CardContent>
      {show ? (
        <ExtendedTheme subtopics={subtopics} description={description} />
      ) : null}
    </Card>
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
    <>
      <Separator />
      <Description description={description} />
      <Separator />
      <SubtopicMap subtopics={subtopics} />
    </>
  );
}

function Description({ description }: { description: string }) {
  return (
    <CardContent className="py-4">
      <p>{description}</p>
    </CardContent>
  );
}

function SubtopicMap({ subtopics }: { subtopics: schema.Subtopic[] }) {
  return subtopics.map((subtopic, i) => (
    <Col gap={8}>
      <Topic subtopic={subtopic} />
      {i !== subtopics.length - 1 ? <Separator /> : null}
    </Col>
  ));
}

export default ThemeWrapper;
