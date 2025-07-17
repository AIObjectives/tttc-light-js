"use client";

import { TextIcon } from "../elements";
import Icons from "@/assets/icons";
import { Col, Row } from "../layout";
import { Dispatch, createContext, useContext } from "react";
import { ReportContext } from "../report/Report";
import {
  useOutlineState,
  OutlineTopicNode,
  OutlineSubtopicNode,
  OutlineStateAction,
  OutlineState,
} from "./hooks/useOutlineState";
import { ReportStateAction } from "../report/hooks/useReportState";

type OutlineContextType = {
  dispatch: Dispatch<OutlineStateAction>;
};

const OutlineContext = createContext<OutlineContextType>({
  dispatch: () => {},
});

const outlineSpacing = 2;

function Outline({
  outlineState,
  outlineDispatch,
  reportDispatch,
}: {
  outlineState: OutlineState;
  outlineDispatch: Dispatch<OutlineStateAction>;
  reportDispatch: Dispatch<ReportStateAction>;
}) {
  const { setScrollTo } = useContext(ReportContext);

  return (
    <OutlineContext.Provider value={{ dispatch: outlineDispatch }}>
      <Col gap={2} className="h-full">
        {/* Top icon */}
        <TextIcon icon={<Icons.Outline size={16} />} className="pl-7">
          Outline
        </TextIcon>
        {/* Scrolly part */}
        <Col gap={outlineSpacing} className="overflow-y-scroll no-scrollbar">
          {outlineState.tree.map((node) => (
            <OutlineItem
              key={node.id}
              node={node}
              title={node.title}
              onBodyClick={() => setScrollTo([node.id, Date.now()])}
              onIconClick={() =>
                reportDispatch({
                  type: "toggleTopic",
                  payload: { id: node.id },
                })
              }
            >
              {/* Since we're only going two levels deep, directly call the render for the subnodes here. */}
              {node?.children?.map((subnode) => (
                <OutlineItem
                  key={subnode.id}
                  node={subnode}
                  title={subnode.title}
                  heirarchyDepth={1}
                  isLeafNode={true}
                  parentId={node.id}
                  onBodyClick={() =>
                    reportDispatch({
                      type: "open",
                      payload: { id: subnode.id },
                    })
                  }
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
  isLeafNode = false,
  onBodyClick,
  onIconClick = () => null,
}: React.PropsWithChildren<{
  node: OutlineTopicNode | OutlineSubtopicNode;
  title: string;
  isLeafNode?: boolean;
  heirarchyDepth?: number;
  onBodyClick: () => void;
  onIconClick?: () => void;
  parentId?: string;
}>) {
  return (
    // column here because opened nodes should continue the spacing.
    <Col
      gap={outlineSpacing}
      className="pl-2 max-w-[279px]"
      data-testid={"outline-item"}
    >
      <Row
        gap={2}
        className={`group items-center ${node.isHighlighted ? node.color : ""} ${node.hoverColor} cursor-pointer`}
      >
        {/* The Minus icon should appear on hover, but shouldn't shift the spacing */}
        <div
          className={`${node.isHighlighted ? `visible ${node.color}` : "invisible"} content-center`}
          onClick={onBodyClick}
        >
          <Icons.Minus size={12} className="stroke-[1px]" />
        </div>
        {/* Nested items should be further to the right */}

        <p
          className={`pl-${heirarchyDepth * 4} p2 select-none text-ellipsis w-[230px] items-center`}
          onClick={onBodyClick}
          data-testid={"outline-item-clickable"}
        >
          {title}
        </p>
        {node._tag === "OutlineTopicNode" ? (
          <OutlineCarrot
            onClick={onIconClick}
            isOpen={node.isOpen}
            collapsable={!!node.children?.length && !isLeafNode}
          />
        ) : null}
      </Row>

      {node._tag === "OutlineTopicNode" && node.isOpen ? children : null}
    </Col>
  );
}

function OutlineCarrot({
  onClick,
  isOpen,
  collapsable,
}: {
  onClick: () => void;
  isOpen: boolean;
  collapsable: boolean;
}) {
  // If not collapsable, add the component but make it permanently invisible to maintain equal spacing.
  if (!collapsable)
    return (
      <div className="invisible">
        <Icons.OutlineCollapsed />
      </div>
    );
  else if (!isOpen) {
    return (
      <div
        onClick={onClick}
        className="invisible group-hover:visible group-hover:text-muted-foreground hover:bg-slate-200 hover:rounded-sm"
        data-testid={"outline-expander"}
      >
        <Icons.OutlineCollapsed />
      </div>
    );
  } else {
    return (
      <div
        onClick={onClick}
        className="hover:bg-slate-200 hover:rounded-sm"
        data-testid={"outline-expander"}
      >
        <Icons.OutlineExpanded />
      </div>
    );
  }
}

export default Outline;
