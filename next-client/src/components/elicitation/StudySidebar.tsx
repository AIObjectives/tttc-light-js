"use client";

import Link from "next/link";

interface StudyItem {
  id: string;
  name: string;
  month: string;
  participants: number;
}

interface StudySidebarProps {
  studies: StudyItem[];
  activeStudyId?: string;
}

/**
 * Sidebar showing list of studies
 */
export function StudySidebar({ studies, activeStudyId }: StudySidebarProps) {
  return (
    <div className="w-64 bg-white border-r border-slate-200 h-full overflow-auto">
      <div className="p-6 space-y-6">
        <h2 className="text-2xl font-semibold text-slate-900">Studies</h2>

        <div className="space-y-6">
          {studies.map((study) => {
            const isActive = study.id === activeStudyId;

            return (
              <Link
                key={study.id}
                href={`/elicitation/${study.id}`}
                className={`block ${isActive ? "font-medium" : ""}`}
              >
                <div className="space-y-2">
                  <p
                    className={`text-sm ${
                      isActive ? "text-slate-900" : "text-slate-700"
                    }`}
                  >
                    {study.name}
                  </p>
                  <div className="pl-4 space-y-1">
                    <p className="text-sm text-slate-500">{study.month}</p>
                    <p className="text-sm text-slate-500">
                      {study.participants} participants
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
