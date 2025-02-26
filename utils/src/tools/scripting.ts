import fs from "fs-extra";
import { parse as parseCsv } from "csv-parse";

/**
 * If the condition returns true, it will continously run the func its given
 */
export const repeatIfCondition =
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

/**
 * Creates a function that will filter an array based on their file extention.
 */
export const filterByFileType = (type: string) => (args: string[]) =>
  args.filter((arg) => arg.endsWith(type));

export const removeOptions = (removedOptions: string[]) => (args: string[]) =>
  args.filter((arg) => !removedOptions.includes(arg));

/**
 * Parses JSON files
 */
export const parseJSONfile = async (fileName: string): Promise<unknown> =>
  JSON.parse(await fs.readFile(fileName, { encoding: "utf-8" }));

/**
 * Parses CSV filesx
 */
export const parseCsvFile = async (fileName: string): Promise<unknown[]> => {
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

export const readDir = async (path: string) => {
  const dir = await fs.readdir(path);
  const inputFiles = [];
  for await (const item of dir) {
    if (item === ".keep") {
      continue;
    }
    inputFiles.push(item);
  }
  return inputFiles;
};
