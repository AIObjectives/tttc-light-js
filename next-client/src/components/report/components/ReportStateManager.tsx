"use client";

import {
  Button,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@src/components/elements";
import { Col, Row } from "@src/components/layout";
import React, { useEffect, useRef, useState } from "react";
import * as schema from "tttc-common/schema";
import Theme from "@src/components/theme/Theme";

type SortBy = "claims" | "people";

type ThemeState = { theme: schema.Theme; isOpen: boolean };

function ReportStateManager({
  children,
  themes: _themes,
}: React.PropsWithChildren<{ themes: schema.Theme[] }>) {
  const [sortBy, setSortBy] = useState<SortBy>("claims");
  const [themes, setThemes] = useState<ThemeState[]>(
    _themes.map((theme) => ({ theme, isOpen: false })),
  );
  useEffect(() => {
    setThemes((curr) =>
      curr.sort(
        (a, b) =>
          // TODO implement people
          b.theme.topics.flatMap((topic) =>
            sortBy === "claims" ? topic.claims : topic.claims,
          ).length -
          a.theme.topics.flatMap((topic) =>
            sortBy === "claims" ? topic.claims : topic.claims,
          ).length,
      ),
    );
  }, [sortBy]);

  const setThemeState = (thisTheme: schema.Theme) => (state: boolean) => {
    const idx = themes.findIndex((el) => el.theme.id === thisTheme.id);
    if (idx === -1) return;
    setThemes((themes) => [
      ...themes.slice(0, idx),
      { ...themes[idx], isOpen: state },
      ...themes.slice(idx + 1),
    ]);
  };

  const setAllThemesState = (state: boolean) => () =>
    setThemes((themeStates) => [
      ...themeStates.map((themeState) => ({ ...themeState, isOpen: state })),
    ]);
  return (
    <div>
      <ReportToolbar
        sortBy={sortBy}
        setSortBy={setSortBy}
        setAllIsOpen={setAllThemesState}
      />

      <Col gap={4} className="w-3/4 m-auto">
        {children}
        {themes.map(({ theme, isOpen }) => (
          <Theme
            theme={theme}
            isOpen={isOpen}
            setIsOpen={setThemeState(theme)}
          />
        ))}
      </Col>
    </div>
  );
}

export function ReportToolbar({
  sortBy,
  setSortBy,
  setAllIsOpen,
}: {
  sortBy: SortBy;
  setSortBy: (val: SortBy) => void;
  setAllIsOpen: (val: boolean) => () => void;
}) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState<boolean>(false);

  const handleIsSticky = () => {
    const top = toolbarRef.current?.getBoundingClientRect().top;
    const val = top !== undefined && top <= 0;
    setIsSticky(val);
  };

  useEffect(() => {
    window.addEventListener("scroll", handleIsSticky);
    return () => window.removeEventListener("scroll", handleIsSticky);
  }, []);

  return (
    <div className={`bg-white ${isSticky ? "sticky top-0 w-full" : "static"}`}>
      <Row
        // ! make sure this is the same width as the theme cards.
        className={`p-2 justify-between w-3/4  mx-auto`}
        innerRef={toolbarRef}
      >
        <div>
          <ReportSortBy sortBy={sortBy} setSortBy={setSortBy} />
        </div>
        <Row gap={2}>
          <Button onClick={setAllIsOpen(false)} variant={"outline"}>
            Collapse all
          </Button>
          <Button onClick={setAllIsOpen(true)} variant={"secondary"}>
            Expand all
          </Button>
        </Row>
      </Row>
    </div>
  );
}

function ReportSortBy({
  sortBy,
  setSortBy,
}: {
  sortBy: SortBy;
  setSortBy: (val: SortBy) => void;
}) {
  return (
    <Select value={sortBy} onValueChange={(val) => setSortBy(val as SortBy)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="claims">Claims</SelectItem>
          <SelectItem value="people">People</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export default ReportStateManager;
