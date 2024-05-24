import { Row } from "@src/components/layout";
import React from "react";

function TextIcon({
  children,
  icon,
}: React.PropsWithChildren<{ icon: React.ReactNode }>) {
  return (
    <text className="text-muted-foreground text-sm">
      <Row gap={1}>
        {icon}
        {children}
      </Row>
    </text>
  );
}

export { TextIcon };
