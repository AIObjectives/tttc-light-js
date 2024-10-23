import * as React from "react";
const SvgComponent = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    fill="none"
    {...props}
  >
    <path
      stroke="#64748B"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.25}
      {...props}
      d="m9 18 6-6-6-6"
    />
  </svg>
);
export default SvgComponent;
