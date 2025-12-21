"use client";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import {
  type ChangeEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ColumnMappings } from "tttc-common/csv-validation";
import Icons from "@/assets/icons";
import { Button, Input, Separator, Switch } from "@/components/elements";
import { Col, Row } from "@/components/layout";
import { formatBytes } from "@/lib/api/userLimits";
import { useReactiveValue } from "@/lib/hooks/useReactiveValue";
import { cn } from "@/lib/utils/shadcn";
import { useCostEstimate } from "../hooks/useCostEstimate";
import type { FormItemState } from "../hooks/useFormState";
import { useParseCsv } from "../hooks/useParseCSV";
import { useUserCapabilities } from "../hooks/useUserCapabilities";
import { CustomizePromptSection } from "./FormHelpers";
import {
  ColumnMappingWarningModal,
  InvalidCSVErrorModal,
} from "./ValidationModals";

export const FormHeader = () => (
  <Col gap={3}>
    <h3>Survey tool</h3>
    <Row
      gap={2}
      className="p-4 border self-stretch items-center justify-center rounded-[2px]"
    >
      <div>
        <Icons.WhatsApp />
      </div>
      <p className="p2 text-muted-foreground flex-grow">
        Gather report responses using our survey tool directly from
        participants' devices.
      </p>
      <Link
        target="_blank"
        href={
          "https://docs.google.com/forms/d/e/1FAIpQLSfl9vVzX83F537RrAi1JoqvvCr0ScbBtHOx41dnLX7ynX5djA/viewform"
        }
      >
        <Button variant={"secondary"} type="button">
          Use it
        </Button>
      </Link>
    </Row>
  </Col>
);

export const FormAbout = () => (
  <Col gap={3}>
    <h3>Overview</h3>
    <div className="text-muted-foreground">
      <p>
        We send the contents of the data uploaded below through OpenAI’s API to
        extract key claims and topics, and store the resuts as a T3C report on
        this site. Optionally, you can customize the prompts we use for each
        step of the pipeline &ndash; e.g. to focus on particular questions,
        themes, or perspectives in your data.
      </p>
      <br />
      <p>
        Creating a report may take a few minutes, especially for large datasets.
        Consider creating a test report with a smaller portion of your dataset
        first (10-20 rows).
      </p>
      <br />
      <p>
        <strong>For this alpha launch:</strong>
      </p>
      <ul className="list-disc list-outside pl-6">
        <li>
          Once you create a report, it is publicly viewable to anyone with the
          exact URL (we’re adding password-protected & private reports soon).
        </li>
        <li>
          Dataset uploads are limited to 150KB by default &ndash; but we pay the
          OpenAI analysis costs
        </li>
        <li>
          After this alpha phase, we'll support analysis of larger datasets
          using your own OpenAI API key
        </li>
      </ul>
      <br />
      <p>
        Do you have questions, feedback, or interest in working with us directly
        on high-impact applications? Reach out at{" "}
        <a className="underline" href="mailto:hello@aiobjectives.org">
          hello@aiobjectives.org
        </a>
      </p>
    </div>
  </Col>
);

/** Get error message for a form field, considering both touched state and forced display */
function getFieldError(
  field: FormItemState<string>,
  forceShow: boolean,
): string | null {
  if (field.status.tag === "failure") return field.status.error.message;
  if (forceShow) return field.getError();
  return null;
}

export const FormDescription = ({
  title,
  description,
  showErrors = false,
}: {
  title: FormItemState<string>;
  description: FormItemState<string>;
  /** When true, show validation errors even if field hasn't been touched */
  showErrors?: boolean;
}) => {
  const titleError = getFieldError(title, showErrors);
  const descError = getFieldError(description, showErrors);

  return (
    <Col gap={4}>
      <h4>Description</h4>
      <Col gap={2}>
        <Col>
          <label htmlFor="title" className="font-medium">
            Report title
          </label>
          <p className="p2 text-muted-foreground">
            The report title will be visible at the top of your project
          </p>
        </Col>
        <Input
          id="title"
          name="title"
          type="text"
          placeholder="Type here"
          required
          value={title.state}
          onChange={(e) => title.setState(e.target.value)}
          className={cn(titleError && "border-destructive")}
        />
        {titleError && <p className="text-destructive text-sm">{titleError}</p>}
      </Col>
      <Col gap={2}>
        <Col>
          <label htmlFor="description" className="font-medium">
            General description
          </label>
          <p className="p2 text-muted-foreground">
            Description shows up below the title and doesn't influence the
            contents of the report
          </p>
        </Col>
        <Input
          id="description"
          name="description"
          type="text"
          placeholder="Type here"
          required
          value={description.state}
          onChange={(e) => description.setState(e.target.value)}
          className={cn(descError && "border-destructive")}
        />
        {descError && <p className="text-destructive text-sm">{descError}</p>}
      </Col>
    </Col>
  );
};

export function FormDataInput({
  files,
  setFiles,
  showErrors = false,
}: {
  files: FileList | undefined;
  setFiles: (files: FileList | undefined) => void;
  /** When true, show validation error if no file is selected */
  showErrors?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const showMissingFileError = showErrors && !files?.item(0);

  const fileName = useReactiveValue(() => files?.item(0)?.name || "", [files]);

  // Inline error state for broken/empty files
  const [inlineError, setInlineError] = useState<string | null>(null);

  // State for validation modals
  const [warningModalState, setWarningModalState] = useState<{
    isOpen: boolean;
    mappings: ColumnMappings | null;
  }>({
    isOpen: false,
    mappings: null,
  });

  const [errorModalState, setErrorModalState] = useState<{
    isOpen: boolean;
    suggestions: string[];
    detectedHeaders: string[];
  }>({
    isOpen: false,
    suggestions: [],
    detectedHeaders: [],
  });

  const { userSizeLimit, capabilitiesLoaded } = useUserCapabilities();

  // Only parse CSV after capabilities are loaded to avoid race conditions
  const { result } = useParseCsv(
    capabilitiesLoaded ? files : undefined,
    userSizeLimit,
  );

  const handleReset = useCallback(
    (ref: RefObject<HTMLInputElement | null>) => {
      if (!ref.current || !ref.current.files) return;
      ref.current.value = "";
      setFiles(undefined);
    },
    [setFiles],
  );

  useEffect(() => {
    if (!result) return;
    else if (result.tag === "failure") {
      if (
        result.error.tag === "Broken file" ||
        result.error.tag === "Size Error"
      ) {
        // Hard errors - show inline error and reset file
        const errorMessage =
          result.error.tag === "Broken file"
            ? "File is broken or has no data"
            : `File is too large - ${formatBytes(userSizeLimit)} limit`;
        setInlineError(errorMessage);
        handleReset(inputRef);
      } else if (result.error.tag === "Invalid CSV") {
        // Invalid CSV - show error modal and reset file
        setErrorModalState({
          isOpen: true,
          suggestions: result.error.suggestions,
          detectedHeaders: result.error.detectedHeaders,
        });
        handleReset(inputRef);
      } else if (result.error.tag === "Non-standard format") {
        // Non-standard format - show warning modal, allow proceed
        setWarningModalState({
          isOpen: true,
          mappings: result.error.mappings,
        });
      }
    }
  }, [result, userSizeLimit, handleReset]);

  const handleCsvUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const maybeFiles = event.target.files;
    if (!maybeFiles) return;
    setInlineError(null); // Clear any previous error
    setFiles(maybeFiles);
  };

  const handleButtonClick = () => inputRef.current?.click();

  return (
    <>
      {/* Warning modal for non-standard but mappable CSV formats */}
      {warningModalState.isOpen && warningModalState.mappings && (
        <ColumnMappingWarningModal
          isOpen={warningModalState.isOpen}
          mappings={warningModalState.mappings}
          onCancel={() => {
            handleReset(inputRef);
            setWarningModalState({
              isOpen: false,
              mappings: null,
            });
          }}
          onProceed={() => {
            setWarningModalState({
              isOpen: false,
              mappings: null,
            });
          }}
        />
      )}

      {/* Error modal for invalid CSV (missing required columns) */}
      <InvalidCSVErrorModal
        isOpen={errorModalState.isOpen}
        suggestions={errorModalState.suggestions}
        detectedHeaders={errorModalState.detectedHeaders}
        onClose={() => {
          setErrorModalState({
            isOpen: false,
            suggestions: [],
            detectedHeaders: [],
          });
        }}
      />
      <Col gap={4}>
        <h4>Input data (as CSV file)</h4>
        <div>
          <p className="p2 text-muted-foreground">
            Upload your data in .csv format. The file must have the following
            columns: “id” (a unique identifier for each comment) and “comment”
            (the participant's response). Optionally, include an “interview”
            column for participant names; otherwise, participants will be
            considered anonymous. CSV data is sent to OpenAI as part of report
            generation.
          </p>
          <br />
          <p className="p2 text-muted-foreground">
            Download our{" "}
            <a
              className="underline"
              href="/Talk-to-the-City-Sample.csv"
              download
            >
              sample CSV
            </a>{" "}
            to see the required format, or upload it directly to try the tool.
          </p>
        </div>

        <div>
          {!inputRef.current?.files?.[0] ? (
            <Button
              name="csvUpload"
              type="button"
              onClick={handleButtonClick}
              variant={"secondary"}
            >
              Choose file
            </Button>
          ) : (
            <Row gap={3}>
              <Button
                id="resetData"
                name="resetData"
                type="reset"
                onClick={() => handleReset(inputRef)}
                variant={"ghost"}
              >
                Reset
              </Button>
              <p className="text-muted-foreground self-center">{fileName}</p>
            </Row>
          )}
          <Input
            name="dataInput"
            id="dataInput"
            type="file"
            className="hidden"
            onChange={handleCsvUpload}
            accept="csv"
            required
            ref={inputRef}
          />
        </div>

        {/* Error for missing file (shown after submit attempt) */}
        {showMissingFileError && (
          <p className="text-destructive text-sm">Add a CSV file</p>
        )}

        {/* Inline error banner for broken/empty files */}
        {inlineError && (
          <div className="flex items-start gap-2 p-4 rounded-lg border border-destructive bg-background">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-destructive mt-0.5" />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-destructive">
                Error
              </span>
              <span className="text-sm text-destructive">{inlineError}</span>
            </div>
          </div>
        )}
      </Col>
    </>
  );
}

export function CostEstimate({ files }: { files: FileList | undefined }) {
  const { userSizeLimit, capabilitiesLoaded } = useUserCapabilities();
  const cost = useCostEstimate(
    capabilitiesLoaded ? files : undefined,
    userSizeLimit,
  );
  return (
    <Col gap={4}>
      <h4>Cost</h4>
      <Col gap={2} className="p-4 pb-6 border rounded-lg">
        <p className="font-medium">{cost}</p>
        <p className="text-muted-foreground">
          This estimate is based on past reports. Typically, our real cost vary
          between by 10-15% up or down. A general guideline is that 1 MB costs
          approximately $24, so 0.5 MB would be around $12, and 10 MB about
          $240.
        </p>
      </Col>
    </Col>
  );
}

/**
 * Contains all of our prompt inputs
 */
const CustomizePrompts = ({
  show,
  systemInstructions,
  clusteringInstructions,
  extractionInstructions,
  dedupInstructions,
  summariesInstructions,
}: {
  show: boolean;
  systemInstructions: FormItemState<string>;
  clusteringInstructions: FormItemState<string>;
  extractionInstructions: FormItemState<string>;
  dedupInstructions: FormItemState<string>;
  summariesInstructions: FormItemState<string>;
}) => {
  return (
    <Col gap={8} className={show ? "" : "hidden"}>
      <Col gap={4}>
        <h4>Customize AI prompts</h4>
        <p className="p2 text-muted-foreground">
          Optionally customize the prompts we use to generate the report, e.g.
          to focus on specific questions, topics, or perspectives. Changing
          these the prompts will change the resulting report.
        </p>
      </Col>
      <CustomizePromptSection
        title="Role prompt for all steps"
        subheader="This prompt helps AI understand how to approach generating reports. It is prepended to all the steps of the report generation flow shown below."
        inputName="systemInstructions"
        formState={systemInstructions}
      />
      <CustomizePromptSection
        title="Step 1 – Topics and subtopics prompt"
        subheader="In the first step, the AI finds the most frequent topics and subtopics mentioned in the comments and writes short descriptions for each."
        inputName="clusteringInstructions"
        formState={clusteringInstructions}
      />
      <CustomizePromptSection
        title="Step 2 – Claim extraction prompt"
        subheader="In the second step, the AI summarizes each particpant's comments as key claims with supporting quotes from the original text.
      It then assigns the claim to the most relevant subtopic in the report. This prompt runs once for each participant's comment"
        inputName="extractionInstructions"
        formState={extractionInstructions}
      />
      <CustomizePromptSection
        title="Step 3 – Merging claims prompt"
        subheader="In the third step, AI collects very similar or near-duplicate statements under one representative claim"
        inputName="dedupInstructions"
        formState={dedupInstructions}
      />
      <CustomizePromptSection
        title="Step 4 – Topic summaries prompt"
        subheader="In the final step, AI generates concise summaries for each topic based on all the processed claims and subtopics"
        inputName="summariesInstructions"
        formState={summariesInstructions}
      />
    </Col>
  );
};

/**
 * Cruxes Feature: Identifies controversial statements that divide participants.
 *
 * Generates "crux claims" - synthesized statements (not original quotes) that best
 * capture the most divisive perspective within each subtopic.
 *
 * Requirements for generation:
 * - ≥2 speakers per subtopic
 * - ≥2 claims per subtopic
 * - cruxesEnabled checkbox = true
 *
 * Output: report.data[1].addOns = { subtopicCruxes[], topicScores[], speakerCruxMatrix }
 * Each subtopic gets one crux with controversy scoring (0-1, higher = more evenly split)
 */
export const EnableResearchFeatures = ({
  show,
  cruxesEnabled,
  cruxInstructions,
  bridgingEnabled,
}: {
  show: boolean;
  cruxesEnabled: FormItemState<boolean>;
  cruxInstructions: FormItemState<string>;
  bridgingEnabled: FormItemState<boolean>;
}) => {
  return (
    <Col gap={4} className={`${show ? "" : "hidden"}`}>
      <Col gap={2}>
        <h4>Enable Research Features</h4>
        <Row gap={2}>
          <Switch
            id="cruxesEnabled"
            name="cruxesEnabled"
            checked={cruxesEnabled.state}
            onCheckedChange={(val) => cruxesEnabled.setState(val)}
          />
          <label className="font-medium" htmlFor="cruxesEnabled">
            Extract cruxes to distill conflicting opinions
          </label>
        </Row>
        <p className="p2 text-muted-foreground">
          For each subtopic, identify the most divisive perspective that splits
          participants into agree/disagree groups. Scores each crux by how
          evenly participants are divided (higher = more controversial).
        </p>
      </Col>

      <CustomizePromptSection
        title="Crux extraction prompt"
        subheader="In this optional step, the AI identifies the most controversial statement within each subtopic and scores how evenly it divides participants."
        inputName="cruxInstructions"
        show={cruxesEnabled.state}
        formState={cruxInstructions}
      />

      <Col gap={2}>
        <Row gap={2}>
          <Switch
            id="bridgingEnabled"
            name="bridgingEnabled"
            checked={bridgingEnabled.state}
            onCheckedChange={(val) => bridgingEnabled.setState(val)}
          />
          <label className="font-medium" htmlFor="bridgingEnabled">
            Score claims and quotes using Perspective API bridging attributes
          </label>
        </Row>
        <p className="p2 text-muted-foreground">
          Analyze claims and quotes for bridge-building qualities (personal
          stories, reasoning, curiosity) vs divisive content (toxicity). Enables
          sorting by bridging potential to surface constructive dialogue.
        </p>
      </Col>
    </Col>
  );
};

/**
 * Contains all of our custom prompts as well as additional features like crux extraction
 */
export function AdvancedSettings({
  systemInstructions,
  clusteringInstructions,
  extractionInstructions,
  dedupInstructions,
  summariesInstructions,
  cruxInstructions,
  cruxesEnabled,
  bridgingEnabled,
}: {
  systemInstructions: FormItemState<string>;
  clusteringInstructions: FormItemState<string>;
  extractionInstructions: FormItemState<string>;
  dedupInstructions: FormItemState<string>;
  summariesInstructions: FormItemState<string>;
  cruxInstructions: FormItemState<string>;
  cruxesEnabled: FormItemState<boolean>;
  bridgingEnabled: FormItemState<boolean>;
}) {
  const [show, setShow] = useState<boolean>(false);

  return (
    <Col gap={8}>
      <Separator orientation="horizontal" />
      <div>
        <Button
          onClick={() => setShow((curr) => !curr)}
          type="button"
          variant={"secondary"}
        >
          {show ? "Hide advanced settings" : "Show advanced settings"}
        </Button>
      </div>
      <CustomizePrompts
        show={show}
        systemInstructions={systemInstructions}
        clusteringInstructions={clusteringInstructions}
        extractionInstructions={extractionInstructions}
        dedupInstructions={dedupInstructions}
        summariesInstructions={summariesInstructions}
      />
      <EnableResearchFeatures
        show={show}
        cruxesEnabled={cruxesEnabled}
        cruxInstructions={cruxInstructions}
        bridgingEnabled={bridgingEnabled}
      />
      <div className={show ? "block" : "hidden"}>
        <Button
          variant={"secondary"}
          type="button"
          onClick={() => setShow((curr) => !curr)}
        >
          Hide advanced settings
        </Button>
      </div>
      <Separator className={`${show ? "" : "hidden"}`} />
    </Col>
  );
}

export function TermsAndConditions() {
  return (
    <Col gap={3}>
      <h4>Terms</h4>
      <a
        href="/T3C-Terms-and-Conditions.pdf"
        className="p2 text-muted-foreground underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        T3C Terms and Conditions and Brand Guidelines
      </a>
    </Col>
  );
}
