import { useState } from "react";

type FormStateWithValidation = {
  getValidationErrors: (files: FileList | undefined) => string[];
};

/**
 * Hook to handle form submit validation.
 * Tracks submit attempts and provides error count for display.
 */
export function useSubmitValidation(
  formState: FormStateWithValidation,
  files: FileList | undefined,
) {
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const validationErrors = formState.getValidationErrors(files);
  const errorCount = validationErrors.length;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (errorCount > 0) {
      e.preventDefault();
      setSubmitAttempted(true);
      return;
    }
    // Form is valid, let it proceed
  };

  return {
    submitAttempted,
    errorCount,
    handleSubmit,
  };
}
