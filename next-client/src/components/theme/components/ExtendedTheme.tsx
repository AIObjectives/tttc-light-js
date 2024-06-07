"use client";

import { Card, CardContent, Button, Separator } from "@src/components/elements";
import React, { useState } from "react";
import * as schema from "tttc-common/schema";
import { Col } from "@src/components/layout";
import Topic from "@src/components/topic/Topic";

function ThemeWrapper({
  children,
  topics,
  isOpen = false,
  setIsOpen,
}: React.PropsWithChildren<{
  topics: schema.Topic[];
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
}>) {
  return (
    <Card>
      <CardContent>
        <Col gap={3}>
          {children}
          <div>
            <Button onClick={() => setIsOpen(!isOpen)}>
              {isOpen ? "Collapse Theme" : "Extend Theme"}
            </Button>
          </div>
        </Col>
      </CardContent>
      {isOpen ? <ExtendedTheme topics={topics} /> : null}
    </Card>
  );
}

function ExtendedTheme({ topics }: { topics: schema.Topic[] }) {
  return (
    <>
      <Separator />
      <ThemeTopics topics={topics} />
    </>
  );
}

function TopicMap({ topics }: { topics: schema.Topic[] }) {
  return topics.map((topic, i) => (
    <Col>
      <Topic topic={topic} />
      <Separator />
    </Col>
  ));
}

function ThemeTopics({ topics }: { topics: schema.Topic[] }) {
  const pagination = 2;

  return (
    <>
      <TopicMap topics={topics.slice(0, pagination)} />
      <TopicLoader topics={topics.slice(pagination)} pagination={pagination} />
    </>
  );
}

function TopicLoader({
  topics,
  pagination,
}: {
  topics: schema.Topic[];
  pagination: number;
}) {
  const [showMore, setShowMore] = useState(false);
  const moreTopics = topics.slice(0, pagination);
  const evenMoreTopics = topics.slice(pagination);
  if (!showMore && topics.length > 0) {
    return (
      <div className="p-4 sm:p-8">
        <Button variant={"secondary"} onClick={() => setShowMore(true)}>
          {topics.length} more topic{topics.length > 1 ? "s" : ""}
        </Button>
      </div>
    );
  } else {
    return (
      <Col>
        <TopicMap topics={moreTopics} />
        {evenMoreTopics.length > 0 ? (
          <TopicLoader topics={evenMoreTopics} pagination={pagination} />
        ) : null}
      </Col>
    );
  }
}

export default ExtendedTheme;
