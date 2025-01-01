"use client";

import { Button } from "../elements";
import Icons from "@src/assets/icons";
import { ReactNode } from "react";
import { toast } from "sonner";

function CopyButton({
  copyStr,
  successMessage,
}: {
  copyStr: string;
  successMessage: string;
}) {
  const copy = async () => navigator.clipboard.writeText(copyStr);
  const notify = async () => toast.success(successMessage);
  return (
    <Button
      size={"icon"}
      variant={"outline"}
      onClick={() => copy().then(notify)}
    >
      <Icons.Copy size={12} className="" />
    </Button>
  );
}

// function CopyLinkButton({ anchor }: { anchor: string }) {
//   const copy = async () =>
//     navigator.clipboard.writeText(
//       location.protocol +
//         "//" +
//         location.host +
//         location.pathname +
//         `#${encodeURIComponent(anchor)}`,
//     );
//   const
//   return <CopyButton  />
// }

export const CopyLinkButton = ({ anchor }: { anchor: string }) => (
  <CopyButton
    copyStr={
      location.protocol +
      "//" +
      location.host +
      location.pathname +
      `#${encodeURIComponent(anchor)}`
    }
    successMessage="Link copied"
  />
);

export default CopyButton;
