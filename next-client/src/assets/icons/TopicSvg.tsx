import * as React from "react";
const SvgComponent = (
  props: React.SVGProps<SVGSVGElement & SVGPathElement>,
) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={17}
    height={16}
    fill="none"
    {...props}
  >
    <path
      stroke="#64748B"
      strokeWidth={1}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
      d="M4.06 1.333a1.333 1.333 0 0 0-1.333 1.334v10.666a1.333 1.333 0 0 0 1.333 1.333h8a1.334 1.334 0 0 0 1.334-1.333v-10.5a1.5 1.5 0 0 0-1.5-1.5H4.06ZM8.727 6H5.394M10.727 8.666H5.394M10.727 11.334H5.394"
    />
  </svg>
);
export default SvgComponent;
