"use client";

import { Button } from "../elements";
import Icons from "@src/assets/icons";

function CopyLinkButton({ anchor }: { anchor: string }) {
  const copy = async () =>
    navigator.clipboard.writeText(
      location.protocol +
        "//" +
        location.host +
        location.pathname +
        `#${encodeURIComponent(anchor)}`,
    );
  const notify = async () => null;
  return (
    <Button
      size={"icon"}
      variant={"outline"}
      onClick={() => copy().then(notify)}
    >
      <Icons.Copy />
    </Button>
  );
}

export default CopyLinkButton;
