import React from "react";

function TextIcon({
  children,
  icon,
}: React.PropsWithChildren<{ icon: React.ReactNode }>) {
  return (
    <p className="p2 text-muted-foreground flex gap-2">
      {icon}
      {children}
    </p>
  );
}

export { TextIcon };