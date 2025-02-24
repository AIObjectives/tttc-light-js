import { reader, select } from "../tools/terminal";
import {
  turboSourceRow,
  turboClaimMap,
  turboTopicClustering,
  splitFileTurboToSchema,
} from "../functions/turboToSchema";
import * as fs from "fs-extra";
import { parse as parseCsv } from "csv-parse";
import assert from "assert";

const repeatIfCondition =
  (condition: (str: string) => boolean) =>
  async (func: () => Promise<string>) => {
    let status: boolean = true;
    let result = "";
    do {
      result = await func();
      status = condition(result);
    } while (status);
    return result;
  };

const filterByFileType = (type: string) => (args: string[]) =>
  args.filter((arg) => arg.endsWith(type));

const jsonFiles = filterByFileType(".json");
const csvFiles = filterByFileType(".csv");

const removeOptions = (removedOptions: string[]) => (args: string[]) =>
  args.filter((arg) => !removedOptions.includes(arg));

const repeatIfEmpty = repeatIfCondition((str) => !str);

const parseJSONfile = async (fileName: string) =>
  JSON.parse(await fs.readFile(fileName, { encoding: "utf-8" }));

const parseCsvFile = async (fileName: string) => {
  const parser = fs.createReadStream(fileName).pipe(
    parseCsv({
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }),
  );
  const records: unknown[] = [];
  for await (const record of parser) {
    records.push(record);
  }
  return records;
};

export const splitFileTurboToSchemaScript = async () => {
  const baseDataPath = "./src/scripts/input";
  console.log(process.cwd());
  const makeFilePath = (fileName: string) => baseDataPath + "/" + fileName;

  // const dir = Deno.readDir(baseDataPath);
  const dir = await fs.readdir(baseDataPath);

  const inputFiles = [];
  for await (const item of dir) {
    if (item === ".keep") {
      continue;
    }
    inputFiles.push(item);
  }

  if (inputFiles.length === 0) {
    throw new Error("There are no data files in scripts/input");
  } else if (inputFiles.length < 3) {
    throw new Error("There are fewer than 3 data files in scripts/input");
  }

  const inputOptions = inputFiles;

  const dataRowOptions = csvFiles(inputOptions);
  const dataRowsName = await select(
    "Which file is your data rows?:",
    dataRowOptions,
  );

  const claimMapOptions = removeOptions([dataRowsName])(
    jsonFiles(inputOptions),
  );

  const claimMapName = await select(
    "Which file is your claim map?",
    claimMapOptions,
  );

  const topicClusteringOptions = removeOptions([dataRowsName, claimMapName])(
    jsonFiles(inputFiles),
  );
  const topicClusteringName = await select(
    "Which file is your topic clustring?",
    topicClusteringOptions,
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

  const parsedClaimsMap = await parseJSONfile(makeFilePath(claimMapName)).then(
    turboClaimMap.safeParse,
  );

  const parsedTopicClustering = await parseJSONfile(
    makeFilePath(topicClusteringName),
  ).then(turboTopicClustering.safeParse);

  const errors = [parsedDataRows, parsedClaimsMap, parsedTopicClustering]
    .map((result) => result.error)
    .filter((err) => err !== undefined);

  if (errors.length > 0) {
    throw new Error(
      "Zod parsers failed: " + errors.map((err) => err.message).join("\n\n"),
    );
  }

  assert(parsedDataRows.data !== undefined);
  assert(parsedClaimsMap.data !== undefined);
  assert(parsedTopicClustering.data !== undefined);

  const schemaData = splitFileTurboToSchema(
    parsedDataRows.data,
    parsedClaimsMap.data,
    parsedTopicClustering.data,
    {
      title,
      description,
      question,
    },
  );

  await fs.writeFile(
    `./src/scripts/output/${outputFileName}.json`,
    new TextEncoder().encode(JSON.stringify(schemaData)),
  );
};
