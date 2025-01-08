import * as React from "react";
const SvgComponent = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={17}
    height={16}
    fill="none"
    {...props}
  >
    <path
      fill="#64748B"
      {...props}
      d="M6.986 11.848H3.423V8.285c0-.642.064-1.242.192-1.798.15-.578.364-1.081.642-1.509.3-.428.674-.77 1.124-1.027.45-.257.974-.386 1.573-.386v1.606c-.364 0-.663.096-.899.289a1.906 1.906 0 0 0-.578.706c-.15.3-.257.642-.32 1.027a9.333 9.333 0 0 0-.065 1.092h1.894v3.563Zm5.875 0H9.298V8.285c0-.642.064-1.242.192-1.798.15-.578.364-1.081.642-1.509.3-.428.675-.77 1.124-1.027.45-.257.974-.386 1.573-.386v1.606c-.364 0-.664.096-.899.289a1.906 1.906 0 0 0-.578.706c-.15.3-.257.642-.32 1.027a9.335 9.335 0 0 0-.065 1.092h1.894v3.563Z"
    />
  </svg>
);
export default SvgComponent;