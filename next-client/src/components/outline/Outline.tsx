"use client";

import { TextIcon } from "../elements";
import Icons from "@assets/icons";
import { Col, Row } from "../layout";
import { Dispatch, createContext, useContext, useState } from "react";
import { ThemeNode } from "@src/types";
import { ReportContext } from "../report/Report";
import useOutlineState, {
  OutlineNode,
  OutlineStateAction,
} from "./hooks/useOutlineState";
import { ReportStateAction } from "../report/hooks/useReportState";

type OutlineContextType = {
  dispatch: Dispatch<OutlineStateAction>;
};

const OutlineContext = createContext<OutlineContextType>({
  dispatch: () => {},
});

function Outline({
  nodes,
  reportDispatch,
}: {
  nodes: ThemeNode[];
  reportDispatch: Dispatch<ReportStateAction>;
}) {
  const [state, dispatch] = useOutlineState({ children: nodes });

  const { useReportEffect } = useContext(ReportContext);

  useReportEffect((action) => {
    const ReportToOutlineActionMap: Partial<
      Record<ReportStateAction["type"], OutlineStateAction["type"]>
    > = {
      open: "open",
      close: "close",
      toggleTheme: "toggle",
      openAll: "openAll",
      closeAll: "closeAll",
    };

    const outlineAction = ReportToOutlineActionMap[action.type];
    if (!outlineAction) return;
    dispatch({ type: outlineAction, payload: action.payload });
  });

  return (
    <OutlineContext.Provider value={{ dispatch }}>
      <Col gap={2}>
        <TextIcon icon={<Icons.Outline />} className="pl-5 ">
          Outline
        </TextIcon>
        <Col gap={2} className="overflow-y-scroll max-h-[80vh]">
          {state.map((node) => (
            <OutlineItem
              node={node}
              title={node.title}
              onClick={() => {
                console.log(node.id);
                reportDispatch({ type: "open", payload: { id: node.id } });
              }}
            >
              {node?.children?.map((subnode) => (
                <OutlineItem
                  node={subnode}
                  title={subnode.title}
                  heirarchyDepth={1}
                  parentId={node.id}
                  onClick={() => {
                    console.log(subnode.id);
                    reportDispatch({
                      type: "open",
                      payload: { id: subnode.id },
                    });
                  }}
                />
              ))}
            </OutlineItem>
          ))}
        </Col>
      </Col>
    </OutlineContext.Provider>
  );
}

function OutlineItem({
  node,
  title,
  children,
  heirarchyDepth = 0,
  onClick,
}: React.PropsWithChildren<{
  node: OutlineNode;
  title: string;
  heirarchyDepth?: number;
  onClick: () => void;
  parentId?: string;
}>) {
  return (
    <Col gap={2} className="max-w-60">
      <Row
        gap={2}
        className={`group items-center ${node.isHighlighted ? "text-primary" : ""} hover:text-primary cursor-pointer`}
      >
        <div className="min-h-6 min-w-3 content-center" onClick={onClick}>
          <Icons.Minus size={12} className="hidden group-hover:block" />
        </div>
        <div
          className={`pl-${heirarchyDepth * 4} pr-4 overflow-hidden whitespace-nowrap`}
        >
          <p
            className="overflow-ellipsis overflow-hidden text-base "
            onClick={onClick}
          >
            {title}
          </p>
        </div>
      </Row>

      {node.isOpen ? children : null}
    </Col>
  );
}

export default Outline;
