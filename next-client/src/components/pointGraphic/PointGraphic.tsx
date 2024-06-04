import React from "react";

function PointGraphic({ num }: { num: number }) {
  return (
    <div className="flex flex-row w-full flex-wrap gap-[3px]">
      {[...Array(num)].map((_) => (
        <ThemeUnit />
      ))}
    </div>
  );
}

function ThemeUnit() {
  return <div className="w-3 h-3 bg-AOI_graph_cell rounded-sm" />;
}

export default PointGraphic;
