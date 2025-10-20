"use client";

import { Button } from "@/components/elements";

interface GoogleSignInButtonProps {
  onClick: () => void;
  disabled?: boolean;
  /** Button label text. Defaults to "Sign in with Google" */
  label?: string;
}

/**
 * Google Sign-In button with branded Google icon.
 * Extracted to avoid duplication across LoginButton and SigninModal.
 */
export function GoogleSignInButton({
  onClick,
  disabled,
  label = "Sign in with Google",
}: GoogleSignInButtonProps) {
  return (
    <Button
      onClick={onClick}
      variant="outline"
      className="gap-2"
      disabled={disabled}
    >
      <svg
        width="18"
        height="18"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 18 18"
        aria-hidden="true"
      >
        <g fill="none" fillRule="evenodd">
          <path
            d="M17.6 9.2l-.1-1.8H9v3.4h4.8C13.6 12 13 13 12 13.6v2.2h3a8.8 8.8 0 0 0 2.6-6.6z"
            fill="#4285F4"
          />
          <path
            d="M9 18c2.4 0 4.5-.8 6-2.2l-3-2.2a5.4 5.4 0 0 1-8-2.9H1V13a9 9 0 0 0 8 5z"
            fill="#34A853"
          />
          <path
            d="M4 10.7a5.4 5.4 0 0 1 0-3.4V5H1a9 9 0 0 0 0 8l3-2.3z"
            fill="#FBBC05"
          />
          <path
            d="M9 3.6c1.3 0 2.5.4 3.4 1.3L15 2.3A9 9 0 0 0 1 5l3 2.4a5.4 5.4 0 0 1 5-3.7z"
            fill="#EA4335"
          />
        </g>
      </svg>
      {label}
    </Button>
  );
}
