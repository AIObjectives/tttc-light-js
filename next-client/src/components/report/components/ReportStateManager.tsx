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
import React, { useEffect, useState } from "react";
import * as schema from "tttc-common/schema";
import Theme from "@src/components/theme/Theme";

type SortBy = "claims" | "people";

type ThemeState = { theme: schema.Theme; isOpen: boolean };

function ReportThemeManager({
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
    <div className="flex justify-center">
      <Col>
        <ReportToolbar
          sortBy={sortBy}
          setSortBy={setSortBy}
          setAllIsOpen={setAllThemesState}
        />
        <Col gap={4} className="max-w-4xl">
          {children}
          {themes.map(({ theme, isOpen }) => (
            <Theme
              theme={theme}
              isOpen={isOpen}
              setIsOpen={setThemeState(theme)}
            />
          ))}
        </Col>
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
  return (
    <Row className="p-2 justify-between">
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
        {/* <SelectLabel><Icons.Select /></SelectLabel>  */}
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Sort By</SelectLabel>
          <SelectItem value="claims">Claims</SelectItem>
          <SelectItem value="people">People</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export default ReportThemeManager;
