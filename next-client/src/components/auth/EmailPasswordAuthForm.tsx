"use client";

import React, { useState } from "react";
import { Button, Input } from "@/components/elements";
import {
  signUpWithEmail,
  signInWithEmail,
  resetPassword,
} from "@/lib/firebase/auth";
import { UserCredential } from "firebase/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants/auth";
import { getPasswordStrength } from "@/lib/utils/password";
import { getFirebaseErrorMessage } from "@/lib/utils/firebaseErrors";

type AuthMode = "signin" | "signup" | "reset";

interface EmailPasswordAuthFormProps {
  onSuccess?: (result: UserCredential) => void;
  onError?: (error: Error) => void;
  initialMode?: AuthMode;
  /** Called when the auth mode changes (signin, signup, reset) */
  onModeChange?: (mode: AuthMode) => void;
}

/**
 * FormField component - provides accessible label + input pairing
 */
function FormField({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

export function EmailPasswordAuthForm({
  onSuccess,
  onError,
  initialMode = "signin",
  onModeChange,
}: EmailPasswordAuthFormProps) {
  const [mode, setModeState] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");

  // Wrapper to update mode and notify parent
  const setMode = (newMode: AuthMode) => {
    setModeState(newMode);
    onModeChange?.(newMode);
  };
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const passwordStrength = getPasswordStrength(password);

  /**
   * Handle password reset request.
   * SECURITY: Always shows success to prevent email enumeration.
   */
  const handlePasswordReset = async (): Promise<void> => {
    try {
      await resetPassword(email);
      console.info("[email-password-auth] Password reset email sent", {
        email,
      });
    } catch (err) {
      // Log error but don't reveal to user whether email exists
      console.error("[email-password-auth] Password reset failed", {
        error: err,
        email,
      });
    }
    // Always show success to prevent email enumeration
    setResetSent(true);
  };

  /**
   * Validate and handle sign up.
   * Returns true if sign up was successful, false if validation failed.
   */
  const handleSignUp = async (): Promise<boolean> => {
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return false;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return false;
    }
    if (!displayName.trim()) {
      setError("Please enter your name");
      return false;
    }

    const result = await signUpWithEmail(email, password, displayName);
    console.info("[email-password-auth] Email sign up successful", {
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName,
    });
    onSuccess?.(result);
    return true;
  };

  /**
   * Handle sign in.
   */
  const handleSignIn = async (): Promise<void> => {
    const result = await signInWithEmail(email, password);
    console.info("[email-password-auth] Email sign in successful", {
      uid: result.user.uid,
      email: result.user.email,
    });
    onSuccess?.(result);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "reset") {
        await handlePasswordReset();
        return;
      }

      if (mode === "signup") {
        const success = await handleSignUp();
        if (!success) return;
      } else {
        await handleSignIn();
      }
    } catch (err) {
      const firebaseError = err as { code?: string; message: string };
      const errorMessage = firebaseError.code
        ? getFirebaseErrorMessage(firebaseError.code)
        : firebaseError.message;

      console.error(`[email-password-auth] Email ${mode} failed`, {
        error: err,
        mode,
        email,
      });
      setError(errorMessage);
      onError?.(err as Error);
    } finally {
      setLoading(false);
    }
  };

  // Password reset success view
  if (resetSent) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          If an account exists with this email, we&apos;ve sent password reset
          instructions. Check your inbox.
        </p>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setMode("signin");
            setResetSent(false);
            setEmail("");
          }}
          className="w-full text-muted-foreground hover:text-foreground"
        >
          Back to Sign In
        </Button>
      </div>
    );
  }

  // Password reset form
  if (mode === "reset") {
    return (
      <div className="flex flex-col gap-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField label="Email address" id="email-input">
            <Input
              id="email-input"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoFocus
            />
          </FormField>

          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="text-sm text-destructive"
            >
              {error}
            </div>
          )}

          <Button type="submit" variant="secondary" disabled={loading}>
            {loading ? "Sending..." : "Send reset email"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setMode("signin");
              setError(null);
            }}
            disabled={loading}
            className="w-full text-muted-foreground hover:text-foreground"
          >
            Back to sign in
          </Button>
        </form>
      </div>
    );
  }

  // Sign in / Sign up form
  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Email address" id="email-input">
          <Input
            id="email-input"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            autoFocus={typeof window !== "undefined" && window.innerWidth > 768}
          />
        </FormField>

        {mode === "signup" && (
          <FormField label="Your name" id="display-name-input">
            <Input
              id="display-name-input"
              type="text"
              autoComplete="name"
              placeholder="John Doe"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              disabled={loading}
            />
          </FormField>
        )}

        <FormField
          label={mode === "signup" ? "Create password" : "Password"}
          id="password-input"
        >
          <Input
            id="password-input"
            type="password"
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            placeholder={
              mode === "signup"
                ? `At least ${MIN_PASSWORD_LENGTH} characters`
                : "Enter your password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            minLength={mode === "signup" ? MIN_PASSWORD_LENGTH : undefined}
          />
          {mode === "signup" && password.length > 0 && (
            <div
              className={`text-xs mt-1 ${passwordStrength.color}`}
              role="status"
              aria-live="polite"
            >
              {passwordStrength.label}
            </div>
          )}
        </FormField>

        {mode === "signup" && (
          <FormField label="Confirm password" id="confirm-password-input">
            <Input
              id="confirm-password-input"
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
              minLength={MIN_PASSWORD_LENGTH}
            />
          </FormField>
        )}

        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="text-sm text-destructive"
          >
            {error}
          </div>
        )}

        <Button type="submit" variant="secondary" disabled={loading}>
          {loading ? "Loading..." : mode === "signup" ? "Sign up" : "Continue"}
        </Button>

        {mode === "signin" && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setMode("reset");
              setError(null);
              setPassword("");
            }}
            disabled={loading}
            className="w-full text-muted-foreground hover:text-foreground"
          >
            Forgot password?
          </Button>
        )}
      </form>

      {/* Toggle between sign-in and sign-up */}
      {mode === "signin" ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setMode("signup");
            setError(null);
            setPassword("");
            setConfirmPassword("");
          }}
          disabled={loading}
          className="w-full text-muted-foreground hover:text-foreground"
        >
          Don&apos;t have an account? Sign up
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setMode("signin");
            setError(null);
            setPassword("");
            setConfirmPassword("");
            setDisplayName("");
          }}
          disabled={loading}
          className="w-full text-muted-foreground hover:text-foreground"
        >
          Already have an account? Sign in
        </Button>
      )}
    </div>
  );
}
