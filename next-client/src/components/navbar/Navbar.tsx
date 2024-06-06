"use client";

import React from "react";
import { Row } from "../layout";
import {
  Button,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from "../elements";
import Icons from "@src/assets/icons";

function Navbar() {
  return (
    <Row
      gap={6}
      className="px-6 items-center justify-between h-16 border-b shadow-sm"
    >
      <Row gap={6} className="h-10 items-center">
        {/* hamburger */}
        <Button variant={"ghost"} size={"icon"}>
          <Icons.Menu size={24} />
        </Button>
        <Separator orientation="vertical" className="h-full" />
        <h3>Talk to the City</h3>
      </Row>

      <Row gap={2} className="items-center">
        {/* github */}
        <Icons.Github />
        {/* about */}
        <div>
          <Button variant={"link"}>About</Button>
        </div>
        {/* language */}
        {/* create report */}
        <div>
          <Select value="eng">
            <SelectTrigger className="border-none">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              <SelectGroup className="w-9">
                <SelectItem value="esp">Spanish</SelectItem>
                <SelectItem value="eng">English</SelectItem>
                <SelectItem value="chn">Chinese</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <Button>
          <Row gap={1}>
            <Icons.Plus className="self-center" size={16} />
            Create report
          </Row>
        </Button>
      </Row>
    </Row>
  );
}

export default Navbar;
