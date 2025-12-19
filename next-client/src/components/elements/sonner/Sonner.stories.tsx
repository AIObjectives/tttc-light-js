import type { Meta, StoryObj } from "@storybook/react";
import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "../button/Button";
import { Toaster } from "./Sonner";
import "../../../app/global.css";

// ! For some reason the stylings aren't applying to the Storybook Sonner

function SonnerStory() {
  return (
    <div className="flex flex-col gap-y-4">
      <Button onClick={() => toast("Normal")}>Normal</Button>
      <Button onClick={() => toast.success("Success")}>Success</Button>
      <Toaster richColors />
    </div>
  );
}

const meta = {
  title: "Sonner",
  component: SonnerStory,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],

  // args: { onClick: fn() },
} satisfies Meta<typeof SonnerStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
