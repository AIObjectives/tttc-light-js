"use client";

import { useReducer, useState } from "react";
import { toast } from "sonner";
import { logger } from "tttc-common/logger/browser";
import Icons from "@/assets/icons";
import { fetchWithRequestId } from "@/lib/api/fetchWithRequestId";
import { fetchToken } from "@/lib/firebase/getIdToken";
import { useUserQuery } from "@/lib/query/useUserQuery";
import { feedbackResponse } from "@/lib/types/clientRoutes";
import { cn } from "@/lib/utils/shadcn";
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

const feedbackLogger = logger.child({ module: "feedback-component" });

export default function Feedback({ className }: { className?: string }) {
  return (
    <div className={cn("fixed bottom-6 right-6", className)}>
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
  const { user, loading, error, emailVerified } = useUserQuery();

  const handleSubmit = async () => {
    // User is guaranteed to exist due to early return below,
    // but TypeScript doesn't know that
    if (!user) return;

    if (!emailVerified) {
      toast.error("Please verify your email to submit feedback");
      dispatch({ type: "close" });
      return;
    }

    try {
      const tokenResult = await fetchToken(user);
      if (tokenResult.tag === "failure") {
        toast.error("Authentication failed");
        dispatch({ type: "close" });
        return;
      }

      const token = tokenResult.value;
      if (!token) {
        toast.error("Authentication failed");
        dispatch({ type: "close" });
        return;
      }

      const httpResponse = await fetchWithRequestId("/api/feedback", {
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
      feedbackLogger.error({ error }, "Feedback submission failed");
      toast.error("Failed to submit feedback");
    }

    dispatch({ type: "close" });
  };

  // Only show feedback button for signed-in users
  // TODO: T3C-944 - Extend to non-signed-in users
  if (loading || error || !user) {
    return null;
  }

  return (
    <Dialog
      open={dialogState.dialog}
      onOpenChange={(open) => !open && dispatch({ type: "close" })}
    >
      <DialogTrigger onClick={() => dispatch({ type: "dialog" })} asChild>
        <Button
          size="icon"
          variant="outline"
          className="rounded-full p-4"
          aria-label="Send feedback"
        >
          <Icons.Feedback size={24} className="stroke-[1.2px]" />
        </Button>
      </DialogTrigger>
      <DialogContent hideClose>
        <DialogHeader>
          <DialogTitle>Tell us what you think!</DialogTitle>
          <DialogDescription className="sr-only">
            Share your feedback about Talk to the City
          </DialogDescription>
        </DialogHeader>
        {!emailVerified ? (
          <p className="text-sm text-muted-foreground py-2">
            Please verify your email to send feedback.
          </p>
        ) : (
          <>
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
          </>
        )}
        <Button variant={"outline"} onClick={() => dispatch({ type: "close" })}>
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
}
