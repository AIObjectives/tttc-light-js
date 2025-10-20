"use client";

import { useState, useEffect } from "react";
import { Button, Input } from "@/components/elements";
import { getFirebaseAuth } from "@/lib/firebase/clientApp";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { logger } from "tttc-common/logger/browser";

const resetLogger = logger.child({ module: "password-reset" });

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

  // Verify the code and get the email
  useEffect(() => {
    const verifyCode = async () => {
      try {
        const auth = getFirebaseAuth();
        const emailFromCode = await verifyPasswordResetCode(auth, actionCode);
        setEmail(emailFromCode);
        resetLogger.info(
          { email: emailFromCode },
          "Password reset code verified",
        );
      } catch (error) {
        resetLogger.error({ error }, "Failed to verify password reset code");
        onError("Invalid or expired password reset link");
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

    if (password.length < 6) {
      onError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const auth = getFirebaseAuth();
      await confirmPasswordReset(auth, actionCode, password);
      resetLogger.info({ email }, "Password reset successful");
      onSuccess();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to reset password. The link may have expired.";
      resetLogger.error({ error, email }, "Password reset failed");
      onError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!email) {
    return (
      <div className="flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="text-sm text-muted-foreground">
        Reset password for <span className="font-medium">{email}</span>
      </div>

      <Input
        type="password"
        placeholder="New Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        disabled={loading}
        minLength={6}
        autoFocus
      />

      <Input
        type="password"
        placeholder="Confirm New Password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        disabled={loading}
        minLength={6}
      />

      <Button type="submit" disabled={loading}>
        {loading ? "Resetting..." : "Reset Password"}
      </Button>
    </form>
  );
}
