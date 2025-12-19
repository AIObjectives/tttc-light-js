import type * as React from "react";

const SvgComponent = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <g id="Info">
      <path
        strokeWidth={1}
        id="Vector"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.80027 4.8C8.80027 5.24182 8.4421 5.6 8.00027 5.6C7.55845 5.6 7.20027 5.24182 7.20027 4.8C7.20027 4.35817 7.55845 4 8.00027 4C8.4421 4 8.80027 4.35817 8.80027 4.8ZM6.40039 6.4H6.93372H8.00039C8.29495 6.4 8.53372 6.63877 8.53372 6.93333V10.6667H9.06706H9.60039V11.7333H9.06706H8.00039H6.93372H6.40039V10.6667H6.93372H7.46706V7.46667H6.93372H6.40039V6.4Z"
        fill="#64748B"
      />
      <path
        strokeWidth={1}
        id="Vector_2"
        d="M8.00065 14.6663C11.6825 14.6663 14.6673 11.6816 14.6673 7.99967C14.6673 4.31778 11.6825 1.33301 8.00065 1.33301C4.31875 1.33301 1.33398 4.31778 1.33398 7.99967C1.33398 11.6816 4.31875 14.6663 8.00065 14.6663Z"
        stroke="#64748B"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  </svg>
);
export default SvgComponent;
