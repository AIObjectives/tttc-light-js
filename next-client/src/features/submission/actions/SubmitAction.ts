import {
  Options,
  PipelineOutput,
  SourceRow,
  options,
} from "tttc-common/schema";
import Papa from "papaparse";
import { NextResponse } from "next/server";

export function formatData(data: any): SourceRow[] {
  const ID_COLS = ["id", "Id", "ID", "comment-id", "i"];
  const COMMENT_COLS = ["comment", "Comment", "comment-body"];
  if (!data || !data.length) {
    throw Error("Invalid or empty data file");
  }
  const keys = new Set(Object.keys(data[0]));
  const id_column = ID_COLS.find((x) => keys.has(x));
  const comment_column = COMMENT_COLS.find((x) => keys.has(x));
  if (!comment_column) {
    throw Error(
      `The csv file must contain a comment column (valid column names: ${COMMENT_COLS.join(", ")})`,
    );
  }
  return data.map((row: any, i: number) => {
    const id = String({ ...row, i }[id_column!]);
    const comment = row[comment_column];
    const res: SourceRow = { id, comment };
    if (keys.has("video")) res.video = row.video;
    if (keys.has("interview")) res.interview = row.interview;
    if (keys.has("timestamp")) res.timestamp = row.timestamp;
    return res;
  });
}

export default async function submitAction(formData: FormData) {
  "use server";

  console.log(1);

  // parses csv file
  const parseCSV = async (file: File): Promise<SourceRow[]> => {
    const buffer = await file.arrayBuffer();
    console.log(2);
    return Papa.parse(Buffer.from(buffer).toString(), { header: true })
      .data as SourceRow[];
  };

  // if csv file is empty, return error
  const data = await parseCSV(formData.get("dataInput") as File);
  if (!data || !data.length) {
    return new NextResponse("Missing data. Check your csv file", {
      status: 400,
    });
  }
  console.log(3);

  const config: Options = options.parse({
    apiKey: formData.get("apiKey"),
    data: data,
    title: formData.get("title"),
    question: formData.get("question"),
    description: formData.get("description"),
    systemInstructions: formData.get("systemInstructions"),
    extractionInstructions: formData.get("extractionInstructions"),
    dedupInstructions: formData.get("dedupInstructions"),
  });

  if (config.apiKey === process.env.OPENAI_API_KEY_PASSWORD) {
    // allow users to use our keys if they provided the password
    config.apiKey = process.env.OPENAI_API_KEY!;
  }
  if (!config.apiKey) {
    throw new Error("Missing key");
  }
  console.log(4);
  console.log(config);
  const url = `http://${process.env.PIPELINE_EXPRESS_URL}/generate`;
  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify(config),
    headers: {
      "Content-Type": "application/json",
    },
  });
  console.log("end", response);
  return await response.json();
  // await testGPT(config.apiKey); // will fail is key is invalid
  // config.filename = config.filename || uniqueSlug(config.title);
  // const url = getUrl(config.filename);
  // await storeHtml(config.filename, placeholderFile());
  // const json = await pipeline(config);
  // const html = await generateServerSideHTML(json)
  // await storeHtml(config.filename, html, true);
  // console.log("produced file: " + url);
}
