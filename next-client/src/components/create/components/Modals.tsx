import React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/elements";
import { Button } from "@/components/elements";
import { signInWithGoogle } from "@/lib/firebase/auth";
import { EmailPasswordAuthForm } from "@/components/auth/EmailPasswordAuthForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/elements";

export function PoorlyFormattedModal({
  isOpen,
  cancelFunc,
  proceedFunc,
}: {
  isOpen: boolean;
  cancelFunc: () => void;
  proceedFunc: () => void;
}) {
  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="w-[329px] gap-6">
        <AlertDialogHeader>
          <AlertDialogTitle>
            We detected a poorly formatted csv. Do you want to proceed?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Please make sure the CSV contains at least two columns named "id"
            and "comment"
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={cancelFunc} asChild>
            <Button variant={"outline"}>Cancel</Button>
          </AlertDialogCancel>
          <AlertDialogAction onClick={proceedFunc} className="bg-destructive">
            Proceed
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export const SigninModal = ({ isOpen }: { isOpen: boolean }) => {
  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Google sign in failed:", error);
    }
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent className="gap-6">
        <DialogHeader>
          <DialogTitle>Sign in to create a report</DialogTitle>
          <DialogDescription>
            Choose your preferred sign-in method
          </DialogDescription>
        </DialogHeader>
        <EmailPasswordAuthForm
          onSuccess={() => {
            console.log("Email auth successful");
          }}
          onError={(error) => {
            console.error("Email auth failed:", error);
          }}
        />
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>
        <Button onClick={handleGoogleSignIn} variant="outline">
          Sign in with Google
        </Button>
      </DialogContent>
    </Dialog>
  );
};
