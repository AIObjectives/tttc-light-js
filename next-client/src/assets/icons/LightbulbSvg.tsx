import type * as React from "react";

const SvgComponent = (
  props: React.SVGProps<SVGSVGElement & SVGPathElement>,
) => (
  <svg
    {...props}
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <title>Lightbulb</title>
    <path
      {...props}
      d="M7.5 15H12.5"
      stroke="#64748B"
      strokeWidth="0.833333"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      {...props}
      d="M8.33203 18.333H11.6654"
      stroke="#64748B"
      strokeWidth="0.833333"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      {...props}
      d="M12.575 11.667C12.725 10.8503 13.1167 10.217 13.75 9.58366C14.1524 9.21324 14.4718 8.76184 14.6872 8.25914C14.9027 7.75644 15.0093 7.21383 15 6.66699C15 5.34091 14.4732 4.06914 13.5355 3.13146C12.5979 2.19378 11.3261 1.66699 10 1.66699C8.67392 1.66699 7.40215 2.19378 6.46447 3.13146C5.52678 4.06914 5 5.34091 5 6.66699C5 7.50033 5.19167 8.52533 6.25 9.58366C6.85338 10.1354 7.265 10.8652 7.425 11.667"
      stroke="#64748B"
      strokeWidth="0.833333"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
export default SvgComponent;
