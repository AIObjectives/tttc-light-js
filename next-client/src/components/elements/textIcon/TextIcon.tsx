import { cn } from "@/lib/utils/shadcn";
import React from "react";

function TextIcon({
  children,
  icon,
  className,
}: React.PropsWithChildren<{ icon: React.ReactNode; className?: string }>) {
  return (
    <p
      className={cn(
        "p2 text-muted-foreground flex gap-[6px] items-center",
        className,
      )}
    >
      {icon}
      {children}
    </p>
  );
}

export { TextIcon };
