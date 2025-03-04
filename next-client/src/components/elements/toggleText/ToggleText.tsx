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
  return (
    <Row
      onClick={() => setIsOpen((state) => !state)}
      className="cursor-pointer select-none"
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
      <p className="text-muted-foreground">{children}</p>
    </div>
  );
}

ToggleText.Title = Title;
ToggleText.Content = Content;
