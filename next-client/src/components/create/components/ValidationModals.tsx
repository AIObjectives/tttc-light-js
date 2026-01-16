import type { ColumnMappings } from "tttc-common/csv-validation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@/components/elements";

/**
 * Column Mapping Warning Modal
 * Shows when CSV format is non-standard but can be processed with column mapping
 */
export function ColumnMappingWarningModal({
  isOpen,
  mappings,
  onCancel,
  onProceed,
}: {
  isOpen: boolean;
  mappings: ColumnMappings;
  onCancel: () => void;
  onProceed: () => void;
}) {
  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-xl md:max-w-2xl gap-6">
        <AlertDialogHeader>
          <AlertDialogTitle>Non-Standard CSV Format Detected</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground space-y-4">
              <p>
                Your CSV uses non-standard column names but can be processed:
              </p>

              <div className="space-y-2 rounded-md bg-muted p-4 text-sm">
                {/* Comment column - always present if we reached this modal */}
                <div className="flex items-center gap-2">
                  <span
                    className="text-green-600 dark:text-green-400"
                    role="img"
                    aria-label="detected"
                  >
                    ✓
                  </span>
                  <span className="font-medium">Comment:</span>
                  {mappings.comment.detected && (
                    <code
                      className="rounded bg-background px-2 py-0.5 max-w-[200px] truncate inline-block"
                      title={mappings.comment.detected}
                    >
                      {mappings.comment.detected}
                    </code>
                  )}
                  {!mappings.comment.isStandard && (
                    <span className="text-muted-foreground text-xs">
                      (non-standard)
                    </span>
                  )}
                </div>

                {/* ID column */}
                <div className="flex items-center gap-2">
                  <span
                    className={
                      mappings.id.usingFallback
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-green-600 dark:text-green-400"
                    }
                    role="img"
                    aria-label={
                      mappings.id.usingFallback ? "using fallback" : "detected"
                    }
                  >
                    {mappings.id.usingFallback ? "ℹ" : "✓"}
                  </span>
                  <span className="font-medium">ID:</span>
                  {mappings.id.usingFallback ? (
                    <span className="text-muted-foreground text-xs">
                      Not detected - row numbers will be used as IDs
                    </span>
                  ) : (
                    <>
                      {mappings.id.detected && (
                        <code
                          className="rounded bg-background px-2 py-0.5 max-w-[200px] truncate inline-block"
                          title={mappings.id.detected}
                        >
                          {mappings.id.detected}
                        </code>
                      )}
                      {!mappings.id.isStandard && (
                        <span className="text-muted-foreground text-xs">
                          (non-standard)
                        </span>
                      )}
                    </>
                  )}
                </div>

                {/* Interview/Speaker column */}
                <div className="flex items-center gap-2">
                  <span
                    className={
                      mappings.interview.detected
                        ? "text-green-600 dark:text-green-400"
                        : "text-blue-600 dark:text-blue-400"
                    }
                    role="img"
                    aria-label={
                      mappings.interview.detected ? "detected" : "not detected"
                    }
                  >
                    {mappings.interview.detected ? "✓" : "ℹ"}
                  </span>
                  <span className="font-medium">Speaker:</span>
                  {mappings.interview.detected ? (
                    <>
                      <code
                        className="rounded bg-background px-2 py-0.5 max-w-[200px] truncate inline-block"
                        title={mappings.interview.detected}
                      >
                        {mappings.interview.detected}
                      </code>
                      {!mappings.interview.isStandard && (
                        <span className="text-muted-foreground text-xs">
                          (non-standard)
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      Not detected - responses will be anonymous
                    </span>
                  )}
                </div>

                {/* Optional: Video column */}
                {mappings.video.detected && (
                  <div className="flex items-center gap-2">
                    <span
                      className="text-green-600 dark:text-green-400"
                      role="img"
                      aria-label="detected"
                    >
                      ✓
                    </span>
                    <span className="font-medium">Video:</span>
                    <code
                      className="rounded bg-background px-2 py-0.5 max-w-[200px] truncate inline-block"
                      title={mappings.video.detected}
                    >
                      {mappings.video.detected}
                    </code>
                  </div>
                )}

                {/* Optional: Timestamp column */}
                {mappings.timestamp.detected && (
                  <div className="flex items-center gap-2">
                    <span
                      className="text-green-600 dark:text-green-400"
                      role="img"
                      aria-label="detected"
                    >
                      ✓
                    </span>
                    <span className="font-medium">Timestamp:</span>
                    <code
                      className="rounded bg-background px-2 py-0.5 max-w-[200px] truncate inline-block"
                      title={mappings.timestamp.detected}
                    >
                      {mappings.timestamp.detected}
                    </code>
                  </div>
                )}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} asChild>
            <Button variant="outline">Cancel</Button>
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onProceed}
            className="bg-indigo-800 hover:bg-indigo-900"
          >
            Proceed with Upload
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Invalid CSV Error Modal
 * Shows when CSV is missing required columns and cannot be processed
 * Styling matches Figma design: Kd7bHvR3spVAIlDA7j7vO4 node 8972-47047
 */
export function InvalidCSVErrorModal({
  isOpen,
  suggestions,
  detectedHeaders,
  onClose,
}: {
  isOpen: boolean;
  suggestions: string[];
  detectedHeaders: string[];
  onClose: () => void;
}) {
  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg gap-4 p-0 shadow-xs">
        {/* Card Header */}
        <AlertDialogHeader className="gap-2 px-6 pt-6">
          <AlertDialogTitle className="text-xl font-semibold leading-7 tracking-[-0.1px]">
            Invalid CSV
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-5 text-muted-foreground">
            Your CSV is missing required columns and cannot be processed. Please
            update it to include one of the accepted column names for comments.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Incorrect column names section */}
        {detectedHeaders.length > 0 && (
          <div className="flex flex-col gap-2 px-6">
            <p className="text-base font-medium leading-6 text-foreground">
              Incorrect column names
            </p>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {detectedHeaders.map((header, idx) => (
                <span
                  key={`header-${idx}-${header}`}
                  className="inline-flex items-center rounded bg-red-50 dark:bg-red-950/50 px-1.5 py-1 text-sm leading-5 tracking-[0.42px] text-muted-foreground"
                >
                  {header}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Accepted column names section */}
        <div className="flex flex-col gap-2 px-6">
          <p className="text-base font-medium leading-6 text-foreground">
            Accepted column names
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, idx) => (
              <span
                key={`suggestion-${idx}-${suggestion}`}
                className="inline-flex items-center rounded border border-border px-1.5 py-1 text-sm leading-5 tracking-[0.42px] text-muted-foreground"
              >
                {suggestion}
              </span>
            ))}
          </div>
        </div>

        {/* Card Footer */}
        <AlertDialogFooter className="px-6 pb-6 pt-0">
          <AlertDialogAction
            onClick={onClose}
            className="bg-indigo-800 hover:bg-indigo-900"
          >
            Choose different file
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
