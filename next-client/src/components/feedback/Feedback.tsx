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
import { useUser } from "@/lib/hooks/getUser";
import { feedbackResponse } from "@/lib/types/clientRoutes";
import { toast } from "sonner";
import Icons from "@/assets/icons";
import { cn } from "@/lib/utils/shadcn";
import { fetchToken } from "@/lib/firebase/getIdToken";

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
  const { user, loading, error } = useUser();

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Please sign in to submit feedback");
      dispatch({ type: "close" });
      return;
    }

    try {
      const tokenResult = await fetchToken(user);
      if (tokenResult[0] === "error") {
        toast.error("Authentication failed");
        dispatch({ type: "close" });
        return;
      }

      const token = tokenResult[1];
      if (!token) {
        toast.error("Please sign in to submit feedback");
        dispatch({ type: "close" });
        return;
      }

      const httpResponse = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: user.uid,
          text,
        }),
      });

      const json = await httpResponse.json();
      const apiResult = feedbackResponse.parse(json).response;

      if (apiResult[0] === "data") {
        toast.success("Thank you for your feedback");
      } else {
        toast.error(apiResult[1].message);
      }
    } catch (error) {
      console.error("Feedback submission failed:", error);
      toast.error("Failed to submit feedback");
    }

    dispatch({ type: "close" });
  };

  // Handle loading and error states
  if (loading) {
    return (
      <div className={cn("fixed bottom-10 right-10")}>
        <Button
          disabled
          size="icon"
          variant="outline"
          className="rounded-full p-4"
        >
          <Icons.Feedback size={24} className="stroke-[1.2px]" />
        </Button>
      </div>
    );
  }

  if (error) {
    return null; // Hide feedback button if auth failed
  }

  return (
    <Dialog open={dialogState.dialog}>
      <DialogTrigger onClick={() => dispatch({ type: "dialog" })}>
        <Button
          asChild
          size={"icon"}
          variant={"outline"}
          className="rounded-full p-4"
        >
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
          disabled={!user} // Disable if no user
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
