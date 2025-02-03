import * as React from "react";
const SvgComponent = (props) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g id="chevron-right">
      <path
        id="Vector"
        d="M9 18L15 12L9 6"
        stroke="#64748B"
        stroke-width="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      />
    </g>
  </svg>
);
export default SvgComponent;
