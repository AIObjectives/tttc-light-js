import { useState, useEffect, useRef } from "react";
import * as prompts from "tttc-common/prompts";
import { Result, success, failure } from "tttc-common/functional-utils";

type FormStatus<T, E> = Result<T, E> | { tag: "initial"; value: T };

export type FormItemState<T> = {
  initialValue: T;
  state: T;
  setState: (val: T) => void;
  status: FormStatus<T, { message: string }>;
  hasChanged: boolean;
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
  }, [val]);

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

  useEffect(() => {
    if (!hasChanged) return;
    else setStatus(statusEval(state));
  }, [state, hasChanged]);

  return {
    initialValue,
    state,
    setState,
    status,
    hasChanged,
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

  const hasValidationErrors = (fields: FormItemState<string>[]) =>
    fields.some((field) => field.status.tag === "failure");

  const hasEmptyRequiredFields = (fields: Array<{ state: string }>) =>
    fields.some((field) => field.state.trim() === "");

  const isCruxValidationInvalid = () =>
    cruxesEnabled.state &&
    (cruxInstructions.status.tag === "failure" ||
      cruxInstructions.state.trim() === "");

  const isFormInvalid = (files: FileList | undefined, token: string | null) => {
    const requiredTextFields = [title, description];
    const allInstructionFields = [
      systemInstructions,
      clusteringInstructions,
      extractionInstructions,
      dedupInstructions,
      summariesInstructions,
    ];

    return (
      !files?.item(0) ||
      !token ||
      hasEmptyRequiredFields(requiredTextFields) ||
      hasValidationErrors([...requiredTextFields, ...allInstructionFields]) ||
      isCruxValidationInvalid()
    );
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
    isFormInvalid,
  };
}
