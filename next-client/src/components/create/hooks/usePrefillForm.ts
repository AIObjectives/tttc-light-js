import { useEffect } from "react";
import type { useFormState } from "./useFormState";

type FormStateReturn = ReturnType<typeof useFormState>;

/**
 * Applies prefill values from URL search params to the form state on mount.
 */
export function usePrefillForm(
  formState: FormStateReturn,
  prefillTitle: string | null,
  prefillDescription: string | null,
): void {
  useEffect(() => {
    if (prefillTitle) formState.title.setState(prefillTitle);
    if (prefillDescription) formState.description.setState(prefillDescription);
    // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount
  }, []);
}
