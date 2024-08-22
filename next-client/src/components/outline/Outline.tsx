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

/**
 * TODO
 * Figure out how to manage state actions here
 */

type OutlineContextType = {
  dispatch: Dispatch<OutlineStateAction>;
};

const OutlineContext = createContext<OutlineContextType>({
  dispatch: () => {},
});

function Outline({
  reportState,
  reportDispatch,
}: {
  reportState: ReportState;
  reportDispatch: Dispatch<ReportStateAction>;
}) {
  const [state, dispatch] = useOutlineState(reportState);

  const { useReportEffect } = useContext(ReportContext);

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
        <TextIcon icon={<Icons.Outline size={16} />} className="pl-5">
          Outline
        </TextIcon>
        <Col gap={2} className="overflow-y-scroll no-scrollbar">
          {state.map((node) => (
            <OutlineItem
              node={node}
              title={node.title}
              onClick={() =>
                reportDispatch({ type: "open", payload: { id: node.id } })
              }
              onDoubleClick={() =>
                dispatch({ type: "toggle", payload: { id: node.id } })
              }
            >
              {node?.children?.map((subnode) => (
                <OutlineItem
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
  const { handleClick, handleDoubleClick } = useXORClick(
    onClick,
    _onDoubleClick,
  );
  return (
    <Col gap={2} className="max-w-60">
      <Row
        gap={2}
        className={`group items-center ${node.isHighlighted ? "text-primary" : ""} hover:text-primary cursor-pointer`}
      >
        <div className="min-h-6 min-w-3 content-center" onClick={onClick}>
          <Icons.Minus
            size={12}
            className="hidden group-hover:block stroke-2"
          />
        </div>
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
