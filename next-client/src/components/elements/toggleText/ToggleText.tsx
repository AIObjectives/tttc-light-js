"use client";
import Icons from "@/assets/icons";
import { Col, Row } from "@/components/layout";
import React, {
  createContext,
  Dispatch,
  SetStateAction,
  useContext,
  useState,
} from "react";

interface IToggleContext {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

const ToggleContext = createContext<IToggleContext>({
  isOpen: false,
  setIsOpen: () => null,
});

export function ToggleText({ children }: React.PropsWithChildren<{}>) {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <ToggleContext.Provider value={{ isOpen, setIsOpen }}>
      <Col gap={1}>{children}</Col>
    </ToggleContext.Provider>
  );
}

function Title({ children }: React.PropsWithChildren<{}>) {
  const { setIsOpen, isOpen } = useContext(ToggleContext);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen((state) => !state);
    }
  };

  return (
    <Row
      onClick={() => setIsOpen((state) => !state)}
      onKeyDown={handleKeyDown}
      className="cursor-pointer select-none"
      role="button"
      tabIndex={0}
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
    </Row>
  );
}

function Content({ children }: React.PropsWithChildren<{}>) {
  const { isOpen } = useContext(ToggleContext);
  return (
    <div className={`pl-5 ${!isOpen ? "hidden" : "block"}`}>
      <div className="text-muted-foreground">{children}</div>
    </div>
  );
}

ToggleText.Title = Title;
ToggleText.Content = Content;
