import * as React from "react";
const SvgComponent = (props) => (
  <svg
    {...props}
    width="40"
    height="40"
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      {...props}
      d="M24 16L16 24"
      stroke="#64748B"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      {...props}
      d="M16 16L24 24"
      stroke="#64748B"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
export default SvgComponent;
