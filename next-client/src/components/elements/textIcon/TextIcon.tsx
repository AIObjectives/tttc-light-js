import React from "react";

function TextIcon({
  children,
  icon,
  className,
}: React.PropsWithChildren<{ icon: React.ReactNode; className?: string }>) {
  return (
    <p className={"p2 text-muted-foreground flex gap-2 " + className}>
      {icon}
      {children}
    </p>
  );
}

export { TextIcon };
