"use client";

import { Button, TextIcon } from "../elements";
import Icons from "@assets/icons";
import { Col, Row } from "../layout";
import * as schema from "tttc-common/schema";
import { useState } from "react";
import { useRouter } from "next/navigation";

function Outline({ themes }: { themes: schema.Theme[] }) {
  return (
    <Col gap={2}>
      <TextIcon icon={<Icons.Outline />} className="pl-5">
        Outline
      </TextIcon>
      {themes.map((theme) => (
        <OutlineItem title={theme.title} subItems={theme.topics} />
      ))}
    </Col>
  );
}

function OutlineItem<T extends { title: string }>({
  title,
  subItems,
  heirarchyDepth = 0,
}: {
  title: string;
  subItems: T[];
  heirarchyDepth?: number;
}) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const router = useRouter();
  const nav = async () =>
    router.push(
      location.protocol +
        "//" +
        location.host +
        location.pathname +
        `#${encodeURIComponent(title)}`,
    );

  const onClick = () => {
    subItems.length && setIsOpen((state) => !state);
    nav();
  };
  return (
    <Col gap={2} className="max-w-60">
      <Row
        gap={2}
        className={`group items-center ${isOpen ? "text-primary" : ""} hover:text-primary cursor-pointer`}
        onClick={() => onClick()}
      >
        <div className="min-h-6 min-w-3 content-center">
          <Icons.Minus size={12} className="hidden group-hover:block" />
        </div>
        <div
          className={`pl-${heirarchyDepth * 4} overflow-hidden whitespace-nowrap`}
        >
          <p className="overflow-ellipsis overflow-hidden text-base ">
            {title}
          </p>
        </div>
        <div className="flex flex-grow justify-end">
          <div className="min-w-4 min-h-4">
            {subItems.length ? (
              <div
                className={`${isOpen ? "block" : "hidden"} group-hover:block bg-slate-200 rounded`}
              >
                <Icons.ChevronRight
                  className={`${isOpen ? "-rotate-90" : "rotate-90"} h-4 w-4`}
                />
              </div>
            ) : null}
          </div>
        </div>
      </Row>
      {isOpen
        ? subItems.map((item) => (
            <OutlineItem
              title={item.title}
              subItems={[]}
              heirarchyDepth={heirarchyDepth + 1}
            />
          ))
        : null}
    </Col>
  );
}

function TopicItem({ topic }: { topic: schema.Topic }) {
  const { title } = topic;
  return <p>{title}</p>;
}

export default Outline;
