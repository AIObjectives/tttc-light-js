"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.formatData = formatData;
exports.placeholderFile = void 0;
exports.uniqueSlug = uniqueSlug;
function uniqueSlug(str) {
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
  return final;
}
function formatData(data) {
  console.log("formatData, data: ", JSON.stringify(data, null, 2));
  const ID_COLS = ["id", "Id", "ID", "comment-id", "i"];
  const COMMENT_COLS = ["comment", "Comment", "comment-body"];
  if (!data || !data.length) {
    throw Error("Invalid or empty data file");
  }
  const keys = new Set(Object.keys(data[0]));
  const id_column = ID_COLS.find(x => keys.has(x));
  const comment_column = COMMENT_COLS.find(x => keys.has(x));
  if (!comment_column) {
    throw Error(`The csv file must contain a comment column (valid column names: ${COMMENT_COLS.join(", ")})`);
  }
  return data.map((row, i) => {
    const id = String({
      ...row,
      i
    }[id_column]);
    const comment = row[comment_column];
    const res = {
      id,
      comment
    };
    if (keys.has("video")) res.video = row.video;
    if (keys.has("interview")) res.interview = row.interview;
    if (keys.has("timestamp")) res.timestamp = row.timestamp;
    return res;
  });
}
const placeholderFile = () => `<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />
</head>
<body>
    Your report is under way. <br/>
    Trying refresh this page soon. 
</body>
</html>`;
exports.placeholderFile = placeholderFile;