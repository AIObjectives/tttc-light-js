import React from "react";

function PointGraphic({ num }: { num: number }) {
  return (
    <div className="flex flex-row w-full flex-wrap gap-px">
      {[...Array(num)].map((_) => (
        <ThemeUnit />
      ))}
    </div>
  );
}

function ThemeUnit() {
  return <div className="w-3 h-3 bg-slate-200 dark:bg-zinc-600 rounded-sm" />;
}

export default PointGraphic;
