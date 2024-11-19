"use client";
import React, {
  ChangeEvent,
  forwardRef,
  RefObject,
  useRef,
  useState,
} from "react";
import { useFormState } from "react-dom";
import * as api from "tttc-common/api";
import { Col, Row } from "../layout";
import { Button, Card, CardContent } from "../elements";
import { Input } from "../elements";
import SubmitFormControl from "@src/features/submission/components/SubmitFormControl";
import Icons from "@src/assets/icons";
import { useCostEstimate } from "./hooks/useCostEstimate";

const initialState: api.GenerateApiResponse | null = null;

export default function CreateReport() {
  const [state, formAction] = useFormState(() => null, initialState);
  const [files, setFiles] = useState<FileList | undefined>(undefined);

  return (
    <form id="reportForm" action={formAction}>
      <SubmitFormControl response={state}>
        <Col gap={8} className="mb-20">
          <FormHeader />
          <FormDescription />
          <FormDataInput setFiles={setFiles} />
          <FormOpenAIKey />
          <CustomizePrompts />
          <CostEstimate files={files} />
          <div>
            <Button size={"sm"} type="submit">
              Generate the report
            </Button>
          </div>
        </Col>
      </SubmitFormControl>
    </form>
  );
}

const FormHeader = () => (
  <Col gap={3}>
    <h3>Report details</h3>
    <p>Lorem ipsum</p>
  </Col>
);

const FormDescription = () => (
  <Col gap={4}>
    <h4>Description</h4>
    <Col gap={2}>
      <Col>
        <label htmlFor="title" className="font-medium">
          Report title
        </label>
        <p className="p2">
          Report title will be visible at the top of your project
        </p>
      </Col>
      <Input
        id="title"
        name="title"
        type="text"
        placeholder="Type here"
        required
      />
    </Col>
    <Col gap={2}>
      <Col>
        <label>General description</label>
        <p className="p2">
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
      />
    </Col>
  </Col>
);

function FormDataInput({
  setFiles,
}: {
  setFiles: (files: FileList | undefined) => void;
}) {
  const [fileName, setFileName] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const handleCsvUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const maybeFiles = event.target.files;
    if (!maybeFiles) return;
    setFileName(maybeFiles[0].name);
    setFiles(maybeFiles);
  };

  const handleButtonClick = () => inputRef.current?.click();

  const handleReset = (ref: RefObject<HTMLInputElement>) => {
    if (!ref.current || !ref.current.files) return;
    ref.current.value = "";
    setFileName("");
    setFiles(undefined);
  };

  return (
    <Col gap={4}>
      <h4>Data</h4>
      <div>
        <p className="p2">
          Upload your data in .csv format. The file must have the following
          columns: “id” (a unique identifier for each comment) and “comment”
          (the participant's response). Optionally, include a “name” column for
          participant names; otherwise, participants will be considered
          anonymous.
        </p>
        <p className="p2">
          You can download a sample CSV template here to get started.
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
              id="resetDadta"
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
          name="csvUploadInput"
          id="csvUploadInput"
          type="file"
          className="hidden"
          onChange={handleCsvUpload}
          accept="csv"
          required
          ref={inputRef}
        />
      </div>
    </Col>
  );
}

const FormOpenAIKey = () => (
  <Col gap={4}>
    <label htmlFor="apiKey">
      <h4>OpenAI Key</h4>
    </label>
    <Input
      id="apiKey"
      name="apiKey"
      placeholder="Type OpenAI key here"
      required
    />
  </Col>
);

const CustomizePrompts = () => (
  <Col gap={8}>
    <Col gap={4}>
      <h4>Customize AI prompts</h4>
      <p className="p2">
        Optionally you can customize our prompts we use to generate the report.
        Changing the text of prompts will influence how the report is rendered.
      </p>
    </Col>
    <CustomizePromptSection
      title="Role prompt"
      subheader="This prompt helps AI understand how to approach generating reports. It is prepended to all the steps of the report generation flow listed below."
      inputName="rolePrompt"
      defaultValue="INSERT ROLE PROMPT"
    />
    <CustomizePromptSection
      title="Step 1 – Topics and subtopics prompt"
      subheader="This is the first step of the report creation flow. Here AI generates common topics and subtopics and writes descriptions for each."
      inputName="topicSubtopicPrompt"
      defaultValue="INSERT TOPICS PROMPT"
    />
    <CustomizePromptSection
      title="Step 2 – Claim extraction prompt"
      subheader="In the second step AI takes comments of each participants and renders them against topics and subtopics from the previous step. Then it distills relevant claims and quotes. This prompt is run as many times as there are participants."
      inputName="claimExtract"
      defaultValue="INSERT CLAIM EXTRACTION PROMPT"
    />
    <CustomizePromptSection
      title="Step 3 – Merging claims prompt"
      subheader="In the last step AI merges similar claims."
      inputName="mergePrompt"
      defaultValue="INSERT MERGE PROMPT"
    />
  </Col>
);

function CustomizePromptSection({
  title,
  subheader,
  inputName,
  defaultValue,
}: {
  title: string;
  subheader: string;
  inputName: string;
  defaultValue: string;
}) {
  const [formValue, setFormValue] = useState<string>("");

  return (
    <Col gap={3}>
      <Col gap={1}>
        <p className="font-medium">{title}</p>
        <p className="p2">{subheader}</p>
      </Col>
      <Input
        name={inputName}
        id={inputName}
        placeholder={defaultValue}
        value={formValue}
        onChange={(e) => setFormValue(e.target.value)}
      />
      <div>
        <Button
          variant={"outline"}
          disabled={!formValue || formValue === defaultValue}
        >
          <Row gap={2} className="items-center">
            <Icons.Reset />
            Reset to default
          </Row>
        </Button>
      </div>
    </Col>
  );
}

function CostEstimate({ files }: { files: FileList | undefined }) {
  const cost = useCostEstimate(files);
  return (
    <Col gap={4}>
      <h4>Cost</h4>
      <Col gap={2} className="p-4 pb-8 border rounded-lg">
        <p className="font-medium">{cost}</p>
        <p>
          This estimate is based on [XXX]. Typically, our real cost vary between
          by 10-15% up or down. A general guideline is that 1 MB costs
          approximately $24, so 0.5 MB would be around $12, and 10 MB about
          $120.
        </p>
      </Col>
    </Col>
  );
}
