import * as React from "react";
const SvgComponent = (props) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M6 4L10 8L6 12"
      stroke="#64748B"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...props}
    />
  </svg>
);
export default SvgComponent;
