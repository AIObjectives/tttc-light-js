import { getReportDataObj } from "tttc-common/morphisms";
import * as schema from "tttc-common/schema";
import jsonData from "./aiAssemblies.json";

export const reportData: schema.ReportDataObj = (() => {
  const llmPipelineSafeParse = schema.llmPipelineOutput.safeParse(jsonData);
  if (llmPipelineSafeParse.success)
    return getReportDataObj(llmPipelineSafeParse.data);
  const pipelineSafeParse = schema.pipelineOutput.safeParse(jsonData);
  if (pipelineSafeParse.success) return pipelineSafeParse.data.data[1];
  const dataSafeParse = schema.reportDataObj.safeParse(jsonData);
  if (dataSafeParse.success) return dataSafeParse.data;
  else throw new Error("Incorrect format in testdata");
})();
