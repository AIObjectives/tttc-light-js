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

// Re-export formatData from common for backward compatibility
export { formatData } from "tttc-common/utils";
