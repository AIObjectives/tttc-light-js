"use client";

import { useState, useEffect } from "react";
import { Button, Input } from "@/components/elements";
import { getFirebaseAuth } from "@/lib/firebase/clientApp";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants/auth";
import { getPasswordStrength } from "@/lib/utils/password";
import { getFirebaseErrorMessage } from "@/lib/utils/firebaseErrors";

interface PasswordResetFormProps {
  actionCode: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export function PasswordResetForm({
  actionCode,
  onSuccess,
  onError,
}: PasswordResetFormProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  const passwordStrength = getPasswordStrength(password);

  // Verify the code and get the email
  useEffect(() => {
    const verifyCode = async () => {
      try {
        const auth = getFirebaseAuth();
        const emailFromCode = await verifyPasswordResetCode(auth, actionCode);
        setEmail(emailFromCode);
        console.info("[password-reset] Password reset code verified", {
          email: emailFromCode,
        });
      } catch (error) {
        const firebaseError = error as { code?: string; message: string };
        const errorMessage = firebaseError.code
          ? getFirebaseErrorMessage(firebaseError.code)
          : "Invalid or expired password reset link";
        console.error("[password-reset] Failed to verify password reset code", {
          error,
        });
        onError(errorMessage);
      }
    };
    verifyCode();
  }, [actionCode, onError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      onError("Passwords do not match");
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      onError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    setLoading(true);

    try {
      const auth = getFirebaseAuth();
      await confirmPasswordReset(auth, actionCode, password);
      console.info("[password-reset] Password reset successful", { email });
      onSuccess();
    } catch (error) {
      const firebaseError = error as { code?: string; message: string };
      const errorMessage = firebaseError.code
        ? getFirebaseErrorMessage(firebaseError.code)
        : "Failed to reset password. The link may have expired.";
      console.error("[password-reset] Password reset failed", {
        error,
        email,
      });
      onError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!email) {
    return (
      <div
        className="flex justify-center"
        role="status"
        aria-live="polite"
        aria-label="Verifying reset code"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900">
          <span className="sr-only">Verifying reset code...</span>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="text-sm text-muted-foreground">
        Reset password for <span className="font-medium">{email}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="new-password-input"
          className="text-sm font-medium text-foreground"
        >
          New password
        </label>
        <Input
          id="new-password-input"
          type="password"
          autoComplete="new-password"
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
          minLength={MIN_PASSWORD_LENGTH}
          autoFocus={typeof window !== "undefined" && window.innerWidth > 768}
        />
        {password.length > 0 && (
          <div
            className={`text-xs mt-1 ${passwordStrength.color}`}
            role="status"
            aria-live="polite"
          >
            {passwordStrength.label}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="confirm-new-password-input"
          className="text-sm font-medium text-foreground"
        >
          Confirm new password
        </label>
        <Input
          id="confirm-new-password-input"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter your new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={loading}
          minLength={MIN_PASSWORD_LENGTH}
        />
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? "Resetting..." : "Reset Password"}
      </Button>
    </form>
  );
}
