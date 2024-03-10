import React from "react";
import { Claim, SourceMap } from "src/types";

export interface OpenClaimVideoProps {
    children?:React.ReactNode,
    sourceMap: SourceMap,
    claim: Claim
}