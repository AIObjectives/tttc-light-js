import { Row } from "@src/components/layout";
import React from "react";

function TextIcon({
  children,
  icon,
}: React.PropsWithChildren<{ icon: React.ReactNode }>) {
  return (
    <Row gap={1}>
      {icon}
      {children}
    </Row>
  );
}

export { TextIcon };
