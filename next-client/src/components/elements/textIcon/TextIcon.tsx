import { Row } from "@src/components/layout";
import React from "react";

function TextIcon({
  children,
  icon,
}: React.PropsWithChildren<{ icon: React.ReactNode }>) {
  return (
    <p className="p2 text-muted-foreground">
      <Row gap={1}>
        {icon}
        {children}
      </Row>
    </p>
  );
}

export { TextIcon };
