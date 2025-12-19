import type * as React from "react";

const SvgComponent = (props: React.SVGProps<SVGPathElement>) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g id="Chevron right 16">
      <path
        id="Vector"
        d="M6 4L10 8L6 12"
        stroke="#583295"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      />
    </g>
  </svg>
);
export default SvgComponent;
