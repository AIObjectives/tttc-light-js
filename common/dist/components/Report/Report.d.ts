import React from "react";
import { PipelineOutput, Claim, SourceMap, Subtopic } from "../../schema";
export interface OpenClaimVideoProps {
  children?: React.ReactNode;
  sourceMap: SourceMap;
  claim: Claim;
}
export interface ToggleShowMoreComponentProps {
  children?: React.ReactNode;
  subtopic: Subtopic;
  className: string;
}
type InteractiveComponents = {
  ToggleShowMoreComponent: React.FC<ToggleShowMoreComponentProps>;
  OpenClaimVideo: React.FC<OpenClaimVideoProps>;
};
export type ReportProps = {
  data: PipelineOutput;
};
export declare function Report(
  props: ReportProps & InteractiveComponents,
): React.JSX.Element;
export {};
