"use client";

import { TextIcon } from "../elements";
import Icons from "@assets/icons";
import { Col, Row } from "../layout";
import { Dispatch, createContext, useContext } from "react";
import { ReportContext } from "../report/Report";
import useOutlineState, {
  OutlineNode,
  OutlineStateAction,
} from "./hooks/useOutlineState";
import { ReportState, ReportStateAction } from "../report/hooks/useReportState";
import { useXORClick } from "@src/lib/hooks/useXORClick";

type OutlineContextType = {
  dispatch: Dispatch<OutlineStateAction>;
};

const OutlineContext = createContext<OutlineContextType>({
  dispatch: () => {},
});

const outlineSpacing = 2;

function Outline({
  reportState,
  reportDispatch,
}: {
  reportState: ReportState;
  reportDispatch: Dispatch<ReportStateAction>;
}) {
  // State management for outline
  const [state, dispatch] = useOutlineState(reportState);

  const { useReportEffect } = useContext(ReportContext);

  // When Report State dispatch is called, outline state should dispatch some action
  useReportEffect((action) => {
    const ReportToOutlineActionMap: Partial<
      Record<ReportStateAction["type"], OutlineStateAction["type"]>
    > = {
      open: "open",
      openAll: "openAll",
      close: "close",
      closeAll: "closeAll",
      toggleTopic: "toggle",
      focus: "highlight",
    };

    const outlineAction = ReportToOutlineActionMap[action.type];
    if (!outlineAction) return;
    dispatch({ type: outlineAction, payload: action.payload });
  });

  return (
    <OutlineContext.Provider value={{ dispatch }}>
      <Col gap={2} className="h-full max-w-40 md:max-w-56">
        {/* Top icon */}
        <TextIcon icon={<Icons.Outline size={16} />} className="pl-5">
          Outline
        </TextIcon>
        {/* Scrolly part */}
        <Col gap={outlineSpacing} className="overflow-y-scroll no-scrollbar">
          {state.map((node) => (
            <OutlineItem
              key={node.id}
              node={node}
              title={node.title}
              onClick={() =>
                reportDispatch({ type: "open", payload: { id: node.id } })
              }
              onDoubleClick={() =>
                dispatch({ type: "toggle", payload: { id: node.id } })
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
                  onClick={() =>
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
  onClick,
  onDoubleClick, // Remoove
}: React.PropsWithChildren<{
  node: OutlineNode;
  title: string;
  isLeafNode?: boolean;
  heirarchyDepth?: number;
  onClick: () => void;
  onDoubleClick?: () => void; // Remove
  parentId?: string;
}>) {
  const _onDoubleClick = onDoubleClick ? onDoubleClick : () => null;

  const { handleClick, handleDoubleClick } = useXORClick(
    onClick,
    _onDoubleClick,
  );
  return (
    // column here because opened nodes should continue the spacing.
    <Col gap={outlineSpacing} className=" ">
      <Row
        gap={2}
        className={`group items-center ${node.isHighlighted ? "text-primary" : ""} hover:text-primary cursor-pointer`}
      >
        {/* The Minus icon should appear on hover, but shouldn't shift the spacing */}
        <div
          className="invisible group-hover:visible content-center"
          onClick={handleClick}
        >
          <Icons.Minus size={12} className="stroke-[3px]" />
        </div>
        {/* Nested items should be further to the right */}
        <Row
          gap={2}
          className={`pl-${heirarchyDepth * 4} overflow-hidden whitespace-nowrap items-center justify-between flex-grow`}
        >
          <p
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            className="overflow-ellipsis overflow-hidden text-base select-none"
          >
            {title}
          </p>
          <OutlineCarrot
            onClick={onDoubleClick!}
            isOpen={node.isOpen}
            collapsable={!!node.children?.length && !isLeafNode}
          />
        </Row>
      </Row>

      {node.isOpen ? children : null}
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
      >
        <Icons.OutlineCollapsed />
      </div>
    );
  } else {
    return (
      <div onClick={onClick} className="hover:bg-slate-200 hover:rounded-sm">
        <Icons.OutlineExpanded />
      </div>
    );
  }
}

export default Outline;
