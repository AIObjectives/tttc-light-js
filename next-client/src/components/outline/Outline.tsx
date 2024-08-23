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
      <Col gap={2} className="h-full">
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
  onClick,
  onDoubleClick,
}: React.PropsWithChildren<{
  node: OutlineNode;
  title: string;
  heirarchyDepth?: number;
  onClick: () => void;
  onDoubleClick?: () => void;
  parentId?: string;
}>) {
  const _onDoubleClick = onDoubleClick ? onDoubleClick : () => null;

  // Make onClick and onDoubleClick mutually exlcusive
  const { handleClick, handleDoubleClick } = useXORClick(
    onClick,
    _onDoubleClick,
  );
  return (
    // column here because opened nodes should continue the spacing.
    <Col gap={outlineSpacing} className=" max-w-40 lg:max-w-56">
      <Row
        gap={2}
        className={`group items-center ${node.isHighlighted ? "text-primary" : ""} hover:text-primary cursor-pointer`}
      >
        {/* The Minus icon should appear on hover, but shouldn't shift the spacing */}
        <div className="min-h-6 min-w-3 content-center" onClick={onClick}>
          <Icons.Minus
            size={12}
            className="hidden group-hover:block stroke-2"
          />
        </div>
        {/* Nested items should be further to the right */}
        <div
          className={`pl-${heirarchyDepth * 4} overflow-hidden whitespace-nowrap`}
        >
          <p
            className="overflow-ellipsis overflow-hidden text-base select-none"
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
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
