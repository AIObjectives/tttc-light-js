"use client";

import { PropsWithChildren } from "react";

export default function ToggleShowButton({
  children,
  id,
  klass,
}: PropsWithChildren<{ id: string; klass: string }>) {
  const onPress = (id: string, klass: string) => {
    document.getElementById(id)?.classList.toggle(klass);
  };

  return (
    <div className="clickable" onClick={() => onPress(id, klass)}>
      {children}
    </div>
  );
}
