"use client";

import React, { useState } from "react";
import { cn } from "@src/lib/utils/shadcn";

export function ExpandableText(
  props: React.HTMLAttributes<HTMLParagraphElement>,
) {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <div>
      <p
        {...props}
        className={cn(props.className, `${isOpen ? "" : "line-clamp-2"}`)}
      >
        {props.children}{" "}
      </p>
      {
        <span
          onClick={() => setIsOpen((state) => !state)}
          className="underline cursor-pointer"
        >
          {isOpen ? "Read less" : "Read more"}
        </span>
      }
    </div>
  );
}

// import React, { useState, useLayoutEffect } from 'react'

// const useTruncatedElement = ({ ref }) => {
//   const [isTruncated, setIsTruncated] = useState(false);
//   const [isReadingMore, setIsReadingMore] = useState(false);

//   useLayoutEffect(() => {
//     const { offsetHeight, scrollHeight } = ref.current || {};

//     if (offsetHeight && scrollHeight && offsetHeight < scrollHeight) {
//       setIsTruncated(true);
//     } else {
//       setIsTruncated(false);
//     }
//   }, [ref]);

//   return {
//     isTruncated,
//     isReadingMore,
//     setIsReadingMore,
//   };
// };

// export function ExpandableText({children}:React.PropsWithChildren) {
//   const ref = React.useRef(null);
//   const { isTruncated, isReadingMore, setIsReadingMore } = useTruncatedElement({
//     ref,
//   });

//   // Code to get your note content...

//   return (
//     <div>
//       <p ref={ref} className={`${!isReadingMore && 'line-clamp-2'}`}>
//         {children}
//       </p>
//       {isTruncated && !isReadingMore && (
//         <span onClick={() => setIsReadingMore(true)}>
//           Read more
//         </span>
//       )}
//     </div>
//   )
// }
