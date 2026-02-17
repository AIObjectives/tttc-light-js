"use client";

import { Calendar, FileText, Plus } from "lucide-react";
import Link from "next/link";

interface TimelineEvent {
  id: string;
  name: string;
  date: string;
  icon: "study" | "document" | "new";
  isActive?: boolean;
}

interface StudyTimelineProps {
  events: TimelineEvent[];
  onEventClick?: (eventId: string) => void;
}

/**
 * Timeline component showing study events chronologically
 */
export function StudyTimeline({ events, onEventClick }: StudyTimelineProps) {
  const getIcon = (type: TimelineEvent["icon"]) => {
    switch (type) {
      case "study":
        return <Calendar className="w-6 h-6" />;
      case "document":
        return <FileText className="w-6 h-6" />;
      case "new":
        return <Plus className="w-6 h-6" />;
      default:
        return <Calendar className="w-6 h-6" />;
    }
  };

  return (
    <div className="w-full py-6">
      <div className="relative max-w-4xl mx-auto">
        {/* Timeline line */}
        <div className="absolute left-0 right-0 top-7 h-0.5 bg-slate-200 z-0" />

        {/* Timeline events */}
        <div className="relative flex justify-between items-start z-10">
          {events.map((event) => {
            // For document icons (reports), link to the report page
            const isReport = event.icon === "document";
            const content = (
              <>
                <div
                  className={`
                    w-14 h-14 rounded-full flex items-center justify-center
                    shadow-md transition-all relative z-10
                    ${
                      event.isActive
                        ? "bg-indigo-600 text-white ring-2 ring-indigo-200"
                        : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                    }
                  `}
                >
                  {getIcon(event.icon)}
                </div>
                <span className="text-xs text-slate-500 text-center font-medium">
                  {event.date}
                </span>
              </>
            );

            if (isReport) {
              return (
                <Link
                  key={event.id}
                  href={`/report/${event.id}`}
                  className="flex flex-col items-center gap-2 group min-w-[80px]"
                >
                  {content}
                </Link>
              );
            }

            return (
              <button
                key={event.id}
                type="button"
                onClick={() => onEventClick?.(event.id)}
                className="flex flex-col items-center gap-2 group min-w-[80px]"
              >
                {content}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
