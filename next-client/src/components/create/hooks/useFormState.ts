import { useEffect, useRef, useState } from "react";
import { failure, type Result, success } from "tttc-common/functional-utils";
import * as prompts from "tttc-common/prompts";

type FormStatus<T, E> = Result<T, E> | { tag: "initial"; value: T };

export type FormItemState<T> = {
  initialValue: T;
  state: T;
  setState: (val: T) => void;
  status: FormStatus<T, { message: string }>;
  hasChanged: boolean;
  /** Returns the validation error message if invalid, regardless of hasChanged state */
  getError: () => string | null;
};

type UnChanged<T> = { _tag: "unchanged"; value: T | undefined };
type Changed<T> = { _tag: "changed"; value: T };

/**
 * Tracks to see if an entry has changed
 */
function useHasChanged<T>(val: T) {
  const [state, setState] = useState<UnChanged<T> | Changed<T>>({
    _tag: "unchanged",
    value: val,
  });
  const initialState = useRef<T>(val);

  useEffect(() => {
    if (state._tag === "changed") return;
    if (val === initialState.current) return;
    else setState({ _tag: "changed", value: val });
  }, [val, state._tag]);

  return state._tag === "changed";
}

/**
 * An individual entry in the form data.
 *
 * Hook is used to track things around the entry such as its state, status, etc.
 */
function useFormItem<T>({
  initialValue,
  statusEval,
}: {
  initialValue: T;
  statusEval: (arg: T) => Result<T, { message: string }>;
}): FormItemState<T> {
  const [state, setState] = useState<T>(initialValue);
  const [status, setStatus] = useState<FormStatus<T, { message: string }>>({
    tag: "initial",
    value: initialValue,
  });
  const hasChanged = useHasChanged(state);

  // biome-ignore lint/correctness/useExhaustiveDependencies: statusEval is intentionally omitted - callers pass inline functions that would cause infinite loops if included
  useEffect(() => {
    if (!hasChanged) return;
    else setStatus(statusEval(state));
  }, [state, hasChanged]);

  /** Returns validation error regardless of hasChanged, for forced validation on submit */
  const getError = (): string | null => {
    const result = statusEval(state);
    return result.tag === "failure" ? result.error.message : null;
  };

  return {
    initialValue,
    state,
    setState,
    status,
    hasChanged,
    getError,
  };
}

/**
 * Hook for the report form's state. Will track each data entry (minus csv data) and whether its okay to submit
 */
export function useFormState() {
  const title = useFormItem({
    initialValue: "",
    statusEval: (val) => {
      if (!val.trim()) return failure({ message: "Add the title" });
      return success(val);
    },
  });

  const description = useFormItem({
    initialValue: "",
    statusEval: (val) => {
      if (!val.trim()) return failure({ message: "Add the description" });
      return success(val);
    },
  });

  const systemInstructions = useFormItem({
    initialValue: prompts.defaultSystemPrompt,
    statusEval: (val) => {
      if (!val.trim()) return failure({ message: "Add the prompt" });
      return success(val);
    },
  });

  const clusteringInstructions = useFormItem({
    initialValue: prompts.defaultClusteringPrompt,
    statusEval: (val) => {
      if (!val.trim()) return failure({ message: "Add the prompt" });
      return success(val);
    },
  });

  const extractionInstructions = useFormItem({
    initialValue: prompts.defaultExtractionPrompt,
    statusEval: (val) => {
      if (!val.trim()) return failure({ message: "Add the prompt" });
      return success(val);
    },
  });

  const dedupInstructions = useFormItem({
    initialValue: prompts.defaultDedupPrompt,
    statusEval: (val) => {
      if (!val.trim()) return failure({ message: "Add the prompt" });
      return success(val);
    },
  });

  const summariesInstructions = useFormItem({
    initialValue: prompts.defaultSummariesPrompt,
    statusEval: (val) => {
      if (!val.trim()) return failure({ message: "Add the prompt" });
      return success(val);
    },
  });

  const cruxInstructions = useFormItem({
    initialValue: prompts.defaultCruxPrompt,
    statusEval: (val) => {
      if (!val.trim()) return failure({ message: "Add the prompt" });
      return success(val);
    },
  });

  const cruxesEnabled = useFormItem({
    initialValue: false,
    statusEval: (val) => {
      return success(val);
    },
  });

  const bridgingEnabled = useFormItem({
    initialValue: false,
    statusEval: (val) => {
      return success(val);
    },
  });

  const outputLanguage = useFormItem({
    initialValue: "English",
    statusEval: (val) => {
      // Dropdown with fixed options - always valid
      return success(val);
    },
  });

  /**
   * Returns a list of validation error messages for required fields.
   * Used to show error count on submit attempt.
   */
  const getValidationErrors = (files: FileList | undefined): string[] => {
    const errors: string[] = [];

    // Check title and description (always required)
    const titleError = title.getError();
    if (titleError) errors.push(titleError);

    const descriptionError = description.getError();
    if (descriptionError) errors.push(descriptionError);

    // Check CSV file
    if (!files?.item(0)) {
      errors.push("Add a CSV file");
    }

    return errors;
  };

  return {
    title,
    description,
    systemInstructions,
    clusteringInstructions,
    extractionInstructions,
    dedupInstructions,
    summariesInstructions,
    cruxInstructions,
    cruxesEnabled,
    bridgingEnabled,
    outputLanguage,
    getValidationErrors,
  };
}
