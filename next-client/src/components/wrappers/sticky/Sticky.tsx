"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";

type StickyProps = React.PropsWithChildren<{
  stickyClass?: React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  >["className"];
  top?: string;
}> &
  React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;

export function Sticky({ children, className, stickyClass }: StickyProps) {
  const stickyRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState<boolean>(false);

  const handleIsSticky = () => {
    const top = stickyRef.current?.getBoundingClientRect().top;
    const val = top !== undefined && top <= 0;
    setIsSticky(val);
  };

  useEffect(() => {
    window.addEventListener("scroll", handleIsSticky);
    return () => window.removeEventListener("scroll", handleIsSticky);
  }, []);

  return (
    // <div >

    <div
      ref={stickyRef}
      className={`${className} ${isSticky ? `sticky top-0 ${stickyClass}` : `static`}`}
    >
      {children}
    </div>
    // </div>
  );
}
