"use client";
import type React from "react";
import {
  createContext,
  type Dispatch,
  type SetStateAction,
  useContext,
  useState,
} from "react";
import Icons from "@/assets/icons";
import { Col } from "@/components/layout";

interface IToggleContext {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

const ToggleContext = createContext<IToggleContext>({
  isOpen: false,
  setIsOpen: () => null,
});

export function ToggleText({ children }: React.PropsWithChildren) {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <ToggleContext.Provider value={{ isOpen, setIsOpen }}>
      <Col gap={1}>{children}</Col>
    </ToggleContext.Provider>
  );
}

function Title({ children }: React.PropsWithChildren) {
  const { setIsOpen, isOpen } = useContext(ToggleContext);

  return (
    <button
      type="button"
      onClick={() => setIsOpen((state) => !state)}
      className="flex flex-row cursor-pointer select-none bg-transparent border-none p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-expanded={isOpen}
    >
      <div className="h-4 w-5 self-center justify-items-start">
        {isOpen ? (
          <Icons.OutlineExpanded size={16} />
        ) : (
          <Icons.OutlineCollapsed size={16} />
        )}
      </div>
      <p>{children}</p>
    </button>
  );
}

function Content({ children }: React.PropsWithChildren) {
  const { isOpen } = useContext(ToggleContext);
  return (
    <div className={`pl-5 ${!isOpen ? "hidden" : "block"}`}>
      <div className="text-muted-foreground">{children}</div>
    </div>
  );
}

ToggleText.Title = Title;
ToggleText.Content = Content;
