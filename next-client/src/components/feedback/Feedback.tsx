"use client";
import React, { useReducer, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  TextArea,
} from "../elements";
import { useUser } from "@src/lib/hooks/getUser";
import { feedbackResponse } from "@src/lib/types/clientRoutes";
import { toast } from "sonner";
import Icons from "@assets/icons";
import { cn } from "@src/lib/utils/shadcn";

export default function Feedback({ className }: { className?: string }) {
  return (
    <div className={cn("fixed bottom-10 right-10", className)}>
      <FeedbackForm />
    </div>
  );
}

interface FeedbackDialogState {
  dialog: boolean;
  success: boolean;
  error: [boolean, string];
}

const defaultFeedbackDialogState: FeedbackDialogState = {
  dialog: false,
  success: false,
  error: [false, ""],
};

const feedbackDialogReducer = (
  _: FeedbackDialogState,
  action:
    | { type: "close" | "dialog" | "success" }
    | { type: "error"; payload: string },
): FeedbackDialogState => {
  switch (action.type) {
    case "close":
      return defaultFeedbackDialogState;
    case "dialog":
      return {
        ...defaultFeedbackDialogState,
        dialog: true,
      };
    case "success":
      return {
        ...defaultFeedbackDialogState,
        success: true,
      };
    case "error":
      return {
        ...defaultFeedbackDialogState,
        error: [true, action.payload],
      };
  }
};

function FeedbackForm() {
  const [text, setText] = useState<string>("");
  const [dialogState, dispatch] = useReducer(
    feedbackDialogReducer,
    defaultFeedbackDialogState,
  );
  const user = useUser();

  const handleSubmit = async () => {
    const { response } = await fetch("/api/feedback", {
      method: "POST",
      body: JSON.stringify({
        userId: user?.uid ?? null,
        text,
      }),
    })
      .then((res) => {
        console.log("feedback response", res);
        return res;
      })
      .then(async (res) => {
        const json = await res.json();
        console.log("json", json);
        return json;
      })
      .then(feedbackResponse.parse);

    if (response[0] === "data") {
      toast.success("Thank you for your feedback");
      dispatch({ type: "close" });
    } else {
      toast.error(response[1].message);
      dispatch({ type: "close" });
    }
  };
  return (
    <Dialog open={dialogState.dialog}>
      <DialogTrigger onClick={() => dispatch({ type: "dialog" })}>
        <Button size={"icon"} variant={"outline"} className="rounded-full p-4">
          <Icons.Feedback size={24} className="stroke-[1.2px]" />
        </Button>
      </DialogTrigger>
      <DialogContent hideClose>
        <DialogHeader>
          <DialogTitle>Tell us what you think!</DialogTitle>
        </DialogHeader>
        <TextArea
          placeholder="Type your message here"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button
          onClick={async (e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          Submit
        </Button>
        <Button variant={"outline"} onClick={() => dispatch({ type: "close" })}>
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
}
