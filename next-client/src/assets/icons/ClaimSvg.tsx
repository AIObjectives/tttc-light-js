import * as React from "react";
const SvgComponent = (props) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g id="Claim 16">
      <path
        id="Vector"
        d="M12.6667 2H3.33333C2.59695 2 2 2.59695 2 3.33333V12.6667C2 13.403 2.59695 14 3.33333 14H12.6667C13.403 14 14 13.403 14 12.6667V3.33333C14 2.59695 13.403 2 12.6667 2Z"
        stroke="#64748B"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      />
    </g>
  </svg>
);
export default SvgComponent;
