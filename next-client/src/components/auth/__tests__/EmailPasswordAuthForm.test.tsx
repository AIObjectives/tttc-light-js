import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants/auth";
import { EmailPasswordAuthForm } from "../EmailPasswordAuthForm";

// Mock Firebase auth functions
vi.mock("@/lib/firebase/auth", () => ({
  signUpWithEmail: vi.fn(),
  signInWithEmail: vi.fn(),
  resetPassword: vi.fn(),
}));

// Mock password utility - return actual implementation for most tests
vi.mock("@/lib/utils/password", () => ({
  getPasswordStrength: vi.fn((password: string) => {
    if (password.length === 0) return { label: "", color: "" };
    if (password.length < MIN_PASSWORD_LENGTH) {
      const remaining = MIN_PASSWORD_LENGTH - password.length;
      return {
        label: `${remaining} more character${remaining > 1 ? "s" : ""} needed`,
        color: "text-muted-foreground",
      };
    }
    return { label: "", color: "" };
  }),
}));

// Mock error utility
vi.mock("@/lib/utils/firebaseErrors", () => ({
  getFirebaseErrorMessage: vi.fn((code: string) => {
    if (code === "auth/invalid-credential") return "Invalid email or password.";
    return "An error occurred.";
  }),
}));

import {
  resetPassword,
  signInWithEmail,
  signUpWithEmail,
} from "@/lib/firebase/auth";
import { getFirebaseErrorMessage } from "@/lib/utils/firebaseErrors";

const mockSignUpWithEmail = vi.mocked(signUpWithEmail);
const mockSignInWithEmail = vi.mocked(signInWithEmail);
const mockResetPassword = vi.mocked(resetPassword);
const mockGetFirebaseErrorMessage = vi.mocked(getFirebaseErrorMessage);

// Helper to create mock UserCredential
const createMockUserCredential = (overrides = {}) => ({
  user: {
    uid: "test-uid",
    email: "test@example.com",
    displayName: "Test User",
    ...overrides,
  },
  providerId: "password",
  operationType: "signIn" as const,
});

describe("EmailPasswordAuthForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("Rendering", () => {
    it("renders sign-in form by default", () => {
      render(<EmailPasswordAuthForm />);

      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /continue/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /forgot password/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /don't have an account/i }),
      ).toBeInTheDocument();
    });

    it("renders sign-up form when initialMode is signup", () => {
      render(<EmailPasswordAuthForm initialMode="signup" />);

      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/create password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
      // Use exact match for submit button to avoid matching the toggle button
      expect(
        screen.getByRole("button", { name: "Sign up" }),
      ).toBeInTheDocument();
    });

    it("renders password reset form when initialMode is reset", () => {
      render(<EmailPasswordAuthForm initialMode="reset" />);

      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /send reset email/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /back to sign in/i }),
      ).toBeInTheDocument();
    });
  });

  describe("Mode switching", () => {
    it("switches from sign-in to sign-up when toggle clicked", async () => {
      const user = userEvent.setup();
      render(<EmailPasswordAuthForm />);

      await user.click(
        screen.getByRole("button", { name: /don't have an account/i }),
      );

      expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    });

    it("switches from sign-in to reset when forgot password clicked", async () => {
      const user = userEvent.setup();
      render(<EmailPasswordAuthForm />);

      await user.click(
        screen.getByRole("button", { name: /forgot password/i }),
      );

      expect(
        screen.getByRole("button", { name: /send reset email/i }),
      ).toBeInTheDocument();
    });

    it("calls onModeChange when mode switches", async () => {
      const user = userEvent.setup();
      const onModeChange = vi.fn();
      render(<EmailPasswordAuthForm onModeChange={onModeChange} />);

      await user.click(
        screen.getByRole("button", { name: /don't have an account/i }),
      );

      expect(onModeChange).toHaveBeenCalledWith("signup");
    });
  });

  describe("Sign-in flow", () => {
    it("calls signInWithEmail with correct credentials", async () => {
      const user = userEvent.setup();
      const mockCredential = createMockUserCredential();
      mockSignInWithEmail.mockResolvedValueOnce(mockCredential as never);

      render(<EmailPasswordAuthForm />);

      await user.type(
        screen.getByLabelText(/email address/i),
        "test@example.com",
      );
      await user.type(
        screen.getByLabelText(/^password$/i),
        "verysecurepassword123",
      );
      await user.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(mockSignInWithEmail).toHaveBeenCalledWith(
          "test@example.com",
          "verysecurepassword123",
        );
      });
    });

    it("calls onSuccess callback on successful sign-in", async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();
      const mockCredential = createMockUserCredential();
      mockSignInWithEmail.mockResolvedValueOnce(mockCredential as never);

      render(<EmailPasswordAuthForm onSuccess={onSuccess} />);

      await user.type(
        screen.getByLabelText(/email address/i),
        "test@example.com",
      );
      await user.type(
        screen.getByLabelText(/^password$/i),
        "verysecurepassword123",
      );
      await user.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(mockCredential);
      });
    });

    it("shows loading state during sign-in", async () => {
      const user = userEvent.setup();
      // Make the promise hang to test loading state
      mockSignInWithEmail.mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      render(<EmailPasswordAuthForm />);

      await user.type(
        screen.getByLabelText(/email address/i),
        "test@example.com",
      );
      await user.type(
        screen.getByLabelText(/^password$/i),
        "verysecurepassword123",
      );
      await user.click(screen.getByRole("button", { name: /continue/i }));

      expect(
        screen.getByRole("button", { name: /loading/i }),
      ).toBeInTheDocument();
    });
  });

  describe("Sign-up flow", () => {
    it("validates password match", async () => {
      const user = userEvent.setup();
      render(<EmailPasswordAuthForm initialMode="signup" />);

      await user.type(
        screen.getByLabelText(/email address/i),
        "test@example.com",
      );
      await user.type(screen.getByLabelText(/your name/i), "Test User");
      await user.type(
        screen.getByLabelText(/create password/i),
        "verysecurepassword1",
      );
      await user.type(
        screen.getByLabelText(/confirm password/i),
        "differentpassword123",
      );
      await user.click(screen.getByRole("button", { name: /sign up/i }));

      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      expect(mockSignUpWithEmail).not.toHaveBeenCalled();
    });

    it("validates minimum password length", async () => {
      const user = userEvent.setup();
      render(<EmailPasswordAuthForm initialMode="signup" />);

      await user.type(
        screen.getByLabelText(/email address/i),
        "test@example.com",
      );
      await user.type(screen.getByLabelText(/your name/i), "Test User");
      await user.type(screen.getByLabelText(/create password/i), "short");
      await user.type(screen.getByLabelText(/confirm password/i), "short");
      await user.click(screen.getByRole("button", { name: /sign up/i }));

      expect(
        screen.getByText(new RegExp(`at least ${MIN_PASSWORD_LENGTH}`, "i")),
      ).toBeInTheDocument();
      expect(mockSignUpWithEmail).not.toHaveBeenCalled();
    });

    it("validates display name is provided", async () => {
      const user = userEvent.setup();
      render(<EmailPasswordAuthForm initialMode="signup" />);

      const longPassword = "a".repeat(MIN_PASSWORD_LENGTH);
      await user.type(
        screen.getByLabelText(/email address/i),
        "test@example.com",
      );
      await user.type(screen.getByLabelText(/your name/i), "   "); // Just whitespace
      await user.type(screen.getByLabelText(/create password/i), longPassword);
      await user.type(screen.getByLabelText(/confirm password/i), longPassword);
      await user.click(screen.getByRole("button", { name: /sign up/i }));

      expect(screen.getByText(/please enter your name/i)).toBeInTheDocument();
      expect(mockSignUpWithEmail).not.toHaveBeenCalled();
    });

    it("calls signUpWithEmail with correct data on valid submission", async () => {
      const user = userEvent.setup();
      const mockCredential = createMockUserCredential();
      mockSignUpWithEmail.mockResolvedValueOnce(mockCredential as never);

      render(<EmailPasswordAuthForm initialMode="signup" />);

      const longPassword = "a".repeat(MIN_PASSWORD_LENGTH);
      await user.type(
        screen.getByLabelText(/email address/i),
        "test@example.com",
      );
      await user.type(screen.getByLabelText(/your name/i), "Test User");
      await user.type(screen.getByLabelText(/create password/i), longPassword);
      await user.type(screen.getByLabelText(/confirm password/i), longPassword);
      await user.click(screen.getByRole("button", { name: /sign up/i }));

      await waitFor(() => {
        expect(mockSignUpWithEmail).toHaveBeenCalledWith(
          "test@example.com",
          longPassword,
          "Test User",
        );
      });
    });
  });

  describe("Password reset flow", () => {
    it("calls resetPassword with email", async () => {
      const user = userEvent.setup();
      mockResetPassword.mockResolvedValueOnce(undefined);

      render(<EmailPasswordAuthForm initialMode="reset" />);

      await user.type(
        screen.getByLabelText(/email address/i),
        "test@example.com",
      );
      await user.click(
        screen.getByRole("button", { name: /send reset email/i }),
      );

      await waitFor(() => {
        expect(mockResetPassword).toHaveBeenCalledWith("test@example.com");
      });
    });

    it("shows success message after reset request (email enumeration prevention)", async () => {
      const user = userEvent.setup();
      mockResetPassword.mockResolvedValueOnce(undefined);

      render(<EmailPasswordAuthForm initialMode="reset" />);

      await user.type(
        screen.getByLabelText(/email address/i),
        "test@example.com",
      );
      await user.click(
        screen.getByRole("button", { name: /send reset email/i }),
      );

      await waitFor(() => {
        expect(screen.getByText(/if an account exists/i)).toBeInTheDocument();
      });
    });

    it("shows success message even when reset fails (email enumeration prevention)", async () => {
      const user = userEvent.setup();
      mockResetPassword.mockRejectedValueOnce(new Error("User not found"));

      render(<EmailPasswordAuthForm initialMode="reset" />);

      await user.type(
        screen.getByLabelText(/email address/i),
        "nonexistent@example.com",
      );
      await user.click(
        screen.getByRole("button", { name: /send reset email/i }),
      );

      // Should still show success to prevent email enumeration
      await waitFor(() => {
        expect(screen.getByText(/if an account exists/i)).toBeInTheDocument();
      });
    });
  });

  describe("Error handling", () => {
    it("displays Firebase error messages on sign-in failure", async () => {
      const user = userEvent.setup();
      const firebaseError = {
        code: "auth/invalid-credential",
        message: "Invalid",
      };
      mockSignInWithEmail.mockRejectedValueOnce(firebaseError);
      mockGetFirebaseErrorMessage.mockReturnValueOnce(
        "Invalid email or password.",
      );

      render(<EmailPasswordAuthForm />);

      await user.type(
        screen.getByLabelText(/email address/i),
        "test@example.com",
      );
      await user.type(
        screen.getByLabelText(/^password$/i),
        "wrongpassword12345678",
      );
      await user.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/invalid email or password/i),
        ).toBeInTheDocument();
      });
    });

    it("calls onError callback on failure", async () => {
      const user = userEvent.setup();
      const onError = vi.fn();
      const firebaseError = new Error("Auth failed");
      mockSignInWithEmail.mockRejectedValueOnce(firebaseError);

      render(<EmailPasswordAuthForm onError={onError} />);

      await user.type(
        screen.getByLabelText(/email address/i),
        "test@example.com",
      );
      await user.type(
        screen.getByLabelText(/^password$/i),
        "wrongpassword12345678",
      );
      await user.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(firebaseError);
      });
    });

    it("clears error when switching modes", async () => {
      const user = userEvent.setup();
      const firebaseError = {
        code: "auth/invalid-credential",
        message: "Invalid",
      };
      mockSignInWithEmail.mockRejectedValueOnce(firebaseError);
      mockGetFirebaseErrorMessage.mockReturnValueOnce(
        "Invalid email or password.",
      );

      render(<EmailPasswordAuthForm />);

      // Trigger an error
      await user.type(
        screen.getByLabelText(/email address/i),
        "test@example.com",
      );
      await user.type(
        screen.getByLabelText(/^password$/i),
        "wrongpassword12345678",
      );
      await user.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/invalid email or password/i),
        ).toBeInTheDocument();
      });

      // Switch mode
      await user.click(
        screen.getByRole("button", { name: /don't have an account/i }),
      );

      // Error should be cleared
      expect(
        screen.queryByText(/invalid email or password/i),
      ).not.toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has accessible labels for all form fields", () => {
      render(<EmailPasswordAuthForm initialMode="signup" />);

      // All inputs should be accessible by label
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/create password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    });

    it("shows error with alert role", async () => {
      const user = userEvent.setup();
      render(<EmailPasswordAuthForm initialMode="signup" />);

      await user.type(
        screen.getByLabelText(/email address/i),
        "test@example.com",
      );
      await user.type(screen.getByLabelText(/your name/i), "Test User");
      await user.type(screen.getByLabelText(/create password/i), "password1");
      await user.type(screen.getByLabelText(/confirm password/i), "password2");
      await user.click(screen.getByRole("button", { name: /sign up/i }));

      const errorAlert = screen.getByRole("alert");
      expect(errorAlert).toBeInTheDocument();
      expect(errorAlert).toHaveTextContent(/passwords do not match/i);
    });
  });
});
