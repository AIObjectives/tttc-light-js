import { ChangeEvent } from "react";

type sessionStorageKeys =
  | "@submissionTitle"
  | "@openAIKey"
  | "@question"
  | "@introParagraph"
  | "@systemPrompt"
  | "@clusteringStep"
  | "@claimExtraction"
  | "@dedup";
type HTMLTextValueElement = HTMLInputElement | HTMLTextAreaElement;

type useSessionStorageReturnType = [
  initialValue: string | undefined,
  syncedFn: (val: string | ChangeEvent<HTMLTextValueElement>) => void,
];

/**
 * Hook that syncs a value with session storage.
 * @returns [initialValue, setValue (synced)]
 */
function useSessionStorage(
  key: sessionStorageKeys,
  fn?: (val: string) => void,
): useSessionStorageReturnType {
  const initialValue: string | undefined =
    typeof window !== "undefined"
      ? sessionStorage.getItem(key) || undefined
      : undefined;

  function wrapperFunc(fn?: (fnVal: string) => void) {
    return (val: string | ChangeEvent<HTMLInputElement>) => {
      if (typeof window === "undefined") return;
      let x = typeof val === "string" ? val : val.target.value;
      sessionStorage.setItem(key, x);
      fn?.(x);
    };
  }

  return [initialValue, wrapperFunc(fn)];
}

export default useSessionStorage;
