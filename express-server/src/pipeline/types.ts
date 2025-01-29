import * as apiPyserver from "tttc-common/apiPyserver";

type ConstructPipelineStep<S extends apiPyserver.PipelineSteps, D> = {
  step: S;
  data: D;
};

export type TopicTreeStep = ConstructPipelineStep<
  "topic_tree",
  apiPyserver.TopicTreeRequest
>;
export type ClaimsStep = ConstructPipelineStep<
  "claims",
  apiPyserver.ClaimsRequest
>;
export type SortClaimTreeStep = ConstructPipelineStep<
  "sort_claims_tree",
  apiPyserver.SortClaimsTreeRequest
>;

export type CruxesStep = ConstructPipelineStep<
  "cruxes",
  apiPyserver.CruxesRequest
>;

export type PipelineStep = TopicTreeStep | ClaimsStep | SortClaimTreeStep | CruxesStep;
