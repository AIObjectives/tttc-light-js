"use client";

import { useState } from "react";
import { Button, Input } from "@/components/elements";
import {
  signUpWithEmail,
  signInWithEmail,
  resetPassword,
} from "@/lib/firebase/auth";
import { logger } from "tttc-common/logger/browser";
import { UserCredential } from "firebase/auth";

const authLogger = logger.child({ module: "email-password-auth" });

type AuthMode = "signin" | "signup" | "reset";

interface EmailPasswordAuthFormProps {
  onSuccess?: (result: UserCredential) => void;
  onError?: (error: Error) => void;
  mode?: AuthMode;
}

export function EmailPasswordAuthForm({
  onSuccess,
  onError,
  mode: initialMode = "signin",
}: EmailPasswordAuthFormProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const getFirebaseErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case "auth/email-already-in-use":
        return "This email is already registered. Try signing in instead.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/weak-password":
        return "Password should be at least 6 characters.";
      case "auth/user-not-found":
      case "auth/wrong-password":
        return "Invalid email or password.";
      case "auth/too-many-requests":
        return "Too many attempts. Please try again later.";
      case "auth/invalid-credential":
        return "Invalid email or password.";
      default:
        return "An error occurred. Please try again.";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "reset") {
        await resetPassword(email);
        authLogger.info({ email }, "Password reset email sent");
        setResetSent(true);
        setLoading(false);
        return;
      }

      if (mode === "signup") {
        if (password !== confirmPassword) {
          setError("Passwords do not match");
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError("Password must be at least 6 characters");
          setLoading(false);
          return;
        }
        const result = await signUpWithEmail(email, password);
        authLogger.info(
          { uid: result.user.uid, email: result.user.email },
          "Email sign up successful",
        );
        onSuccess?.(result);
      } else {
        const result = await signInWithEmail(email, password);
        authLogger.info(
          { uid: result.user.uid, email: result.user.email },
          "Email sign in successful",
        );
        onSuccess?.(result);
      }
    } catch (err) {
      const firebaseError = err as { code?: string; message: string };
      const errorMessage = firebaseError.code
        ? getFirebaseErrorMessage(firebaseError.code)
        : firebaseError.message;

      authLogger.error({ error: err, mode, email }, `Email ${mode} failed`);
      setError(errorMessage);
      onError?.(err as Error);
    } finally {
      setLoading(false);
    }
  };

  if (resetSent) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Password reset email sent! Check your inbox for instructions.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setMode("signin");
            setResetSent(false);
            setEmail("");
          }}
        >
          Back to Sign In
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
        {mode !== "reset" && (
          <>
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              minLength={6}
            />
            {mode === "signup" && (
              <Input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
              />
            )}
          </>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={loading}>
        {loading
          ? "Loading..."
          : mode === "signup"
            ? "Sign Up"
            : mode === "reset"
              ? "Send Reset Email"
              : "Sign In"}
      </Button>

      <div className="flex flex-col gap-2 text-sm">
        {mode === "signin" && (
          <>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className="text-muted-foreground hover:underline"
              disabled={loading}
            >
              Don't have an account? Sign up
            </button>
            <button
              type="button"
              onClick={() => setMode("reset")}
              className="text-muted-foreground hover:underline"
              disabled={loading}
            >
              Forgot password?
            </button>
          </>
        )}
        {(mode === "signup" || mode === "reset") && (
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError(null);
              setPassword("");
              setConfirmPassword("");
            }}
            className="text-muted-foreground hover:underline"
            disabled={loading}
          >
            Back to Sign In
          </button>
        )}
      </div>
    </form>
  );
}
