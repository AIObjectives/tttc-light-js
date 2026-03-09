"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils/shadcn";

export type { DateRange } from "react-day-picker";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({ className, classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-2",
        month: "flex flex-col gap-4",
        month_caption: "flex justify-center pt-1 relative items-center w-full",
        caption_label: "text-sm font-medium",
        nav: "absolute inset-x-1 top-1 flex items-center justify-between",
        button_previous: cn(
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
          "inline-flex items-center justify-center rounded border border-input",
        ),
        button_next: cn(
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
          "inline-flex items-center justify-center rounded border border-input",
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "text-muted-foreground w-9 font-normal text-[0.8rem] flex items-center justify-center pb-1",
        weeks: "w-full",
        week: "flex w-full",
        day: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
        day_button: cn(
          "h-9 w-9 p-0 font-normal",
          "inline-flex items-center justify-center text-sm ring-offset-background transition-colors",
          "hover:bg-muted hover:text-foreground rounded",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
        ),
        // selected covers both single-day and range start/end; range_* overrides below
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:rounded",
        // Range start: bg-primary + rounded on the td itself; button is transparent
        range_start:
          "bg-primary rounded [&>button]:bg-transparent [&>button]:text-primary-foreground [&>button]:hover:bg-transparent [&>button]:rounded-none",
        // Range end: same as range_start
        range_end:
          "bg-primary rounded [&>button]:bg-transparent [&>button]:text-primary-foreground [&>button]:hover:bg-transparent [&>button]:rounded-none",
        // Range middle: bg-muted on the td; button is transparent, no rounding
        range_middle:
          "bg-muted [&>button]:bg-transparent [&>button]:text-foreground [&>button]:hover:bg-transparent [&>button]:rounded-none",
        today: "[&>button]:font-semibold",
        outside: "opacity-30",
        disabled: "opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  );
}
