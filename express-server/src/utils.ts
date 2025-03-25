import { SourceRow } from "tttc-common/schema";

// sync version of sha256 hash to make strong unique urls
// that do not leak
const { createHash } = require("crypto");
function sha256(str: string) {
  return createHash("sha256").update(str).digest("hex");
}

export function uniqueSlug(str: string): string {
  // Convert to lowercase
  const lowerCaseStr = str.toLowerCase();
  // Replace non-letter characters with a dash
  const dashReplacedStr = lowerCaseStr.replace(/[^a-z]+/g, "-");
  // Replace multiple consecutive dashes with a single dash
  const singleDashStr = dashReplacedStr.replace(/-+/g, "-");
  // Trim dashes from the start and end
  const trimmedStr = singleDashStr.replace(/^-+|-+$/g, "");
  // Postfix a timestamp to the slug to make it unique
  const final = trimmedStr + "-" + Date.now();
  // finally hash!
  const sha256Final = sha256(final);
  return sha256Final;
}

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
