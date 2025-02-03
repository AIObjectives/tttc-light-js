import { getReportDataObj } from "tttc-common/morphisms/pipeline";
import * as schema from "tttc-common/schema";
import llmPipelineJson from "./dummyData.json";

const llmPipeline = schema.llmPipelineOutput.parse(llmPipelineJson);

export const reportData: schema.ReportDataObj = getReportDataObj(llmPipeline);
