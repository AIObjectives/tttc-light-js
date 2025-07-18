"use client";
import React, {
  useEffect,
  useState,
  useRef,
  ChangeEvent,
  RefObject,
} from "react";
import { CustomizePromptSection } from "./FormHelpers";
import { PoorlyFormattedModal } from "./Modals";
import { FormItemState } from "../hooks/useFormState";
import { Col, Row } from "@/components/layout";
import { Button, Input, Separator, Switch } from "@/components/elements";
import { useCostEstimate } from "../hooks/useCostEstimate";
import { cn } from "@/lib/utils/shadcn";
import { useParseCsv } from "../hooks/useParseCSV";
import { useReactiveValue } from "@/lib/hooks/useReactiveValue";
import { toast } from "sonner";

export const FormHeader = () => (
  <Col gap={3}>
    <h3>Create a Report</h3>
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
          Dataset uploads are limited to 100KB &ndash; but we pay the OpenAI
          analysis costs
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

export const FormDescription = ({
  title,
  description,
}: {
  title: FormItemState<string>;
  description: FormItemState<string>;
}) => {
  return (
    <Col gap={4}>
      <h4>Report details</h4>
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
          className={cn(title.status.tag === "failure" && "border-destructive")}
        />
        {title.status.tag === "failure" && (
          <p className="text-destructive text-sm">
            {title.status.error.message}
          </p>
        )}
      </Col>
      <Col gap={2}>
        <Col>
          <label htmlFor="description" className="font-medium">
            General description
          </label>
          <p className="p2 text-muted-foreground">
            Description shows up below the title and doesn’t influence the
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
          className={cn(
            description.status.tag === "failure" && "border-destructive",
          )}
        />
        {description.status.tag === "failure" && (
          <p className="text-destructive text-sm">
            {description.status.error.message}
          </p>
        )}
      </Col>
    </Col>
  );
};

export function FormDataInput({
  files,
  setFiles,
}: {
  files: FileList | undefined;
  setFiles: (files: FileList | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const fileName = useReactiveValue(() => files?.item(0)?.name || "", [files]);
  const [modelOpen, setModalOpen] = useState<boolean>(false);

  const { result } = useParseCsv(files);

  useEffect(() => {
    if (!result) return;
    else if (result.tag === "failure") {
      if (
        result.error.tag === "Broken file" ||
        result.error.tag === "Size Error"
      ) {
        const description =
          result.error.tag === "Broken file"
            ? "File is broken or has no data"
            : "File is too large - 150kb limit";
        toast.error("Error", {
          description: description,
          position: "top-center",
        });
        handleReset(inputRef);
      } else if (result.error.tag === "Poorly formatted CSV") {
        setModalOpen(true);
      }
    }
  }, [result]);

  const handleCsvUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const maybeFiles = event.target.files;
    if (!maybeFiles) return;
    setFiles(maybeFiles);
  };

  const handleButtonClick = () => inputRef.current?.click();

  const handleReset = (ref: RefObject<HTMLInputElement>) => {
    if (!ref.current || !ref.current.files) return;
    ref.current.value = "";
    setFiles(undefined);
  };

  return (
    <>
      <PoorlyFormattedModal
        isOpen={modelOpen}
        cancelFunc={() => {
          handleReset(inputRef);
          setModalOpen(false);
        }}
        proceedFunc={() => setModalOpen(false)}
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
            You can reference a{" "}
            <a
              className="underline"
              target="_blank"
              href="https://docs.google.com/spreadsheets/d/15cKedZ-AYPWMJoVFJY6ge9jUEnx1Hu9MHnhQ_E_Z4FA/edit"
            >
              sample CSV template
            </a>{" "}
            here to get started.
          </p>
          <br />
          <p className="p2 text-muted-foreground">
            <label htmlFor="description" className="font-medium">
              Don't want to make your own CSV file?
            </label>
            <br />
            Browse the tabs and select one of our{" "}
            <a
              className="underline"
              target="_blank"
              href="https://docs.google.com/spreadsheets/d/15cKedZ-AYPWMJoVFJY6ge9jUEnx1Hu9MHnhQ_E_Z4FA/edit?gid=862995911#gid=862995911"
            >
              pre-made synthetic datasets
            </a>{" "}
            to get a feel for how T3C extracts quotes and organizes topics from
            general text.
          </p>
        </div>

        <div>
          {!(inputRef.current?.files && inputRef.current.files[0]) ? (
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
      </Col>
    </>
  );
}

export function CostEstimate({ files }: { files: FileList | undefined }) {
  const cost = useCostEstimate(files);
  return (
    <Col gap={4}>
      <h4>Cost</h4>
      <Col gap={2} className="p-4 pb-8 border rounded-lg">
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
}: {
  show: boolean;
  systemInstructions: FormItemState<string>;
  clusteringInstructions: FormItemState<string>;
  extractionInstructions: FormItemState<string>;
  dedupInstructions: FormItemState<string>;
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
        subheader="In the last step, AI collects very similar or near-duplicate statements under one representative claim"
        inputName="dedupInstructions"
        formState={dedupInstructions}
      />
    </Col>
  );
};

export const EnableResearchFeatures = ({
  show,
  cruxesEnabled,
  cruxInstructions,
}: {
  show: boolean;
  cruxesEnabled: FormItemState<boolean>;
  cruxInstructions: FormItemState<string>;
}) => {
  return (
    <Col gap={4} className={`${show ? "" : "hidden"}`}>
      <Col gap={2}>
        <h4>Enable Research Features</h4>
        <Row gap={2}>
          <Switch
            id="cruxEnabled"
            name="cruxEnabled"
            checked={cruxesEnabled.state}
            onCheckedChange={(val) => cruxesEnabled.setState(val)}
          />
          <label className="font-medium" htmlFor="cruxEnabled">
            Extract cruxes to distill conflicting opinions
          </label>
        </Row>
        <p className="p2 text-muted-foreground">
          Suggest pairs of perspective-summarizing "crux" statements which would
          best split participants into agree/disagree groups or sides of about
          equal size.
        </p>
      </Col>

      <CustomizePromptSection
        title="Crux extraction prompt"
        subheader="In this optional step, the AI suggests pairs of `crux` statements to summarize the most controverisal perspectives within each topic."
        inputName="cruxInstructions"
        show={cruxesEnabled.state}
        formState={cruxInstructions}
      />
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
  cruxInstructions,
  cruxesEnabled,
}: {
  systemInstructions: FormItemState<string>;
  clusteringInstructions: FormItemState<string>;
  extractionInstructions: FormItemState<string>;
  dedupInstructions: FormItemState<string>;
  cruxInstructions: FormItemState<string>;
  cruxesEnabled: FormItemState<boolean>;
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
      />
      <EnableResearchFeatures
        show={show}
        cruxesEnabled={cruxesEnabled}
        cruxInstructions={cruxInstructions}
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
    <div className="text-muted-foreground">
      <h4>Preliminary Terms of Service</h4>
      <br />
      <p>
        By accessing the Talk to the City report creation feature, users comply
        with the following terms and conditions:
      </p>
      <br />
      <p>
        Data Processing: Upon submission, your data will be transmitted to
        OpenAI's API for processing and subsequent storage on our platform.
        Users maintain responsibility for the data they submit.
      </p>
      <br />
      <p>Important Disclosures:</p>
      <ul className="list-disc list-outside pl-6">
        <li>
          Exercise appropriate caution when submitting text containing sensitive
          or personally identifiable information
        </li>
        <li>
          Generated reports are assigned a unique URL and are publicly
          accessible by default
        </li>
        <li>
          Features for private and password-protected reports are in development
        </li>
      </ul>
    </div>
  );
}
