import { Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils/shadcn";

interface SpinnerProps extends React.ComponentProps<"svg"> {
  /** Accessible label for screen readers. Defaults to "Loading" */
  label?: string;
}

function Spinner({ className, label = "Loading", ...props }: SpinnerProps) {
  return (
    <Loader2Icon
      role="status"
      aria-label={label}
      className={cn("size-6 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
