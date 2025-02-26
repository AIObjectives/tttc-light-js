import {
  turboSourceRow,
  TranslatedReport,
  TurboSourceRow,
} from "../schema/turboData";
import {
  filterByFileType,
  parseCsvFile,
  parseJSONfile,
  readDir,
  repeatIfCondition,
} from "../tools/scripting";
import { reader, select } from "../tools/terminal";
import { llmPipelineToSchema } from "../../../common/morphisms/pipeline";
import * as fs from "fs-extra";
import * as schema from "tttc-common/schema";
import * as uuid from "uuid";

const csvFiles = filterByFileType("csv");
const jsonFiles = filterByFileType("json");
const repeatIfEmpty = repeatIfCondition((str) => !str);

const translateSourceRow = (turbo: TurboSourceRow): schema.SourceRow => ({
  ...turbo,
  id: turbo["comment-id"],
  comment: turbo["comment-body"],
});

export default async function turboToSchemaScript() {
  const baseDataPath = "./src/scripts/input";
  const makeFilePath = (fileName: string) => baseDataPath + "/" + fileName;

  const inputFiles = await readDir(baseDataPath);

  if (inputFiles.length === 0) {
    throw new Error("There are no data files in scripts/input");
  }

  const language = await select("Which language translation do you want?", [
    "EN",
    "ES",
  ]);

  const dataRowsName = await select(
    "Which file is your data csv?",
    csvFiles(inputFiles),
  );

  const reportDataName = await select(
    "Which file is your report data tree?",
    jsonFiles(inputFiles),
  );

  console.log("Now we just need a few more things: \n\n");

  const title = await repeatIfEmpty(() =>
    reader("What is your report's name?: "),
  );

  const description = await repeatIfEmpty(() =>
    reader("Write a description for your report: "),
  );

  const question = await reader(
    "What question did you ask? (this can be empty): ",
  );

  const outputFileName = await repeatIfEmpty(() =>
    reader("What should your output file name be? (no ext): "),
  );

  const parsedDataRows = await parseCsvFile(makeFilePath(dataRowsName)).then(
    turboSourceRow.array().safeParse,
  );

  const parsedReportData = await parseJSONfile(
    makeFilePath(reportDataName),
  ).then((arg) => arg as TranslatedReport);

  const errors = [parsedDataRows]
    .map((result) => result.error)
    .filter((err) => err !== undefined);
  if (errors.length > 0 || !parsedDataRows.data) {
    throw new Error(
      "Zod parser failed: " + errors.map((err) => err.message).join("\n"),
    );
  }
  const arrayTopics =
    language === "EN"
      ? parsedReportData.translations["en-US"]
      : parsedReportData.translations["es-AR"];

  // cludge to add ids to claims for now
  const arrayTopicsWithIds = arrayTopics.topics.map((t) => {
    return {
      ...t,
      subtopics: t.subtopics.map((s) => {
        return {
          ...s,
          claims: s.claims.map((c) => {
            return {
              ...c,
              claimId: "id" in c ? (c.id as string) : c.claimId || uuid.v4(),
            };
          }),
        };
      }),
    };
  });

  const deduppedTopics = arrayTopicsWithIds.map((t) => {
    return {
      ...t,
      subtopics: t.subtopics.map((s) => {
        return {
          ...s,
          claims: s.claims.reduce((accum, curr) => {
            const repeatedIdx = accum.findIndex((c) => c.claim === curr.claim);
            if (repeatedIdx === -1) {
              return [...accum, curr];
            } else {
              const root = accum[repeatedIdx];
              return [
                ...accum.slice(0, repeatedIdx),
                {
                  ...root,
                  duplicates: [...(root.duplicates || []), curr],
                  ...accum.slice(repeatedIdx),
                },
              ];
            }
          }, [] as schema.LLMClaim[]),
        };
      }),
    };
  });

  const schemaData = llmPipelineToSchema({
    data: parsedDataRows.data.map(translateSourceRow),
    tree: deduppedTopics,
    systemInstructions: "",
    clusteringInstructions: "",
    extractionInstructions: "",
    batchSize: 0,
    start: 0,
    costs: 0,
    title,
    question,
    description,
  });
  await fs.writeFile(
    `./src/scripts/output/${outputFileName}.json`,
    new TextEncoder().encode(JSON.stringify(schemaData)),
  );
}
