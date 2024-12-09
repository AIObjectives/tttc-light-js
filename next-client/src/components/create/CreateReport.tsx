"use client";
import React, {
  ChangeEvent,
  RefObject,
  useEffect,
  useRef,
  useState,
  useActionState,
} from "react";
import * as api from "tttc-common/api";
import { Col, Row } from "../layout";
import { Button, TextArea } from "../elements";
import { Input } from "../elements";
import SubmitFormControl from "@src/features/submission/components/SubmitFormControl";
import Icons from "@src/assets/icons";
import { useCostEstimate } from "./hooks/useCostEstimate";
import { useReactiveValue } from "@src/lib/hooks/useReactiveValue";
import { useParseCsv } from "./hooks/useParseCSV";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from "../elements/alertDialog/AlertDialog";
import Form from "next/form";
import submitAction from "@src/features/submission/actions/SubmitAction";
import { z } from "zod";
import { useForm, FormProvider, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@src/lib/utils/shadcn";
import * as prompts from "tttc-common/prompts";

const initialState: api.GenerateApiResponse | null = null;

// !!! This is copied from schema.LLMUserConfig. For some reason its resulting in an infinite cycle with useForm. Figure this out later.
const form = z.object({
  apiKey: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  systemInstructions: z.string().min(1),
  clusteringInstructions: z.string().min(1),
  extractionInstructions: z.string().min(1),
  dedupInstructions: z.string().min(1),
});

export default function CreateReport() {
  const [state, formAction] = useActionState(submitAction, initialState);
  const [files, setFiles] = useState<FileList | undefined>(undefined);

  const methods = useForm<z.infer<typeof form>>({
    resolver: zodResolver(form),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      title: "",
      description: "",
      apiKey: "",
      systemInstructions: prompts.defaultSystemPrompt,
      clusteringInstructions: prompts.defaultClusteringPrompt,
      extractionInstructions: prompts.defaultExtractionPrompt,
      dedupInstructions: prompts.defaultDedupPrompt,
    },
  });

  const isDisabled = !files?.item(0) || !methods.formState.isValid;

  return (
    <FormProvider {...methods}>
      <Form action={formAction}>
        <SubmitFormControl response={state}>
          <Col gap={8} className="mb-20">
            <FormHeader />
            <FormDescription />
            <FormDataInput files={files} setFiles={setFiles} />
            <FormOpenAIKey />
            <CustomizePrompts />
            <CostEstimate files={files} />
            <div>
              <Button size={"sm"} type="submit" disabled={isDisabled}>
                Generate the report
              </Button>
            </div>
          </Col>
        </SubmitFormControl>
      </Form>
    </FormProvider>
  );
}

const FormHeader = () => (
  <Col gap={3}>
    <h3>Report details</h3>
    <p>Lorem ipsum</p>
  </Col>
);

const FormDescription = () => {
  const { register, formState } = useFormContext();
  const { touchedFields, errors } = formState;
  return (
    <Col gap={4}>
      <h4>Description</h4>
      <Col gap={2}>
        <Col>
          <label htmlFor="title" className="font-medium">
            Report title
          </label>
          <p className="p2 text-muted-foreground">
            Report title will be visible at the top of your project
          </p>
        </Col>
        <Input
          id="title"
          type="text"
          placeholder="Type here"
          required
          className={cn(
            touchedFields.title && errors.title && "border-destructive",
          )}
          {...register("title")}
        />
        {touchedFields.title && errors.title && (
          <p className="text-destructive text-sm">Add the title</p>
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
          type="text"
          placeholder="Type here"
          required
          className={
            touchedFields.description &&
            errors.description &&
            "border-destructive"
          }
          {...register("description")}
        />
        {touchedFields.description && errors.description && (
          <p className="text-destructive text-sm">Add the description</p>
        )}
      </Col>
    </Col>
  );
};

function PoorlyFormattedModal({
  isOpen,
  cancelFunc,
  proceedFunc,
}: {
  isOpen: boolean;
  cancelFunc: () => void;
  proceedFunc: () => void;
}) {
  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="w-[329px] gap-6">
        <AlertDialogHeader>
          <AlertDialogTitle>
            We detected a poorly formatted csv. Do you want to proceed
          </AlertDialogTitle>
          <AlertDialogDescription>Lorem ipsum</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={cancelFunc} asChild>
            <Button variant={"outline"}>Cancel</Button>
          </AlertDialogCancel>
          <AlertDialogAction onClick={proceedFunc} className="bg-destructive">
            Proceed
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function FormDataInput({
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
    console.log(result);
    if (!result) return;
    else if (result[0] === "error") {
      if (result[1].tag === "Broken file") {
        toast.error("Error", {
          description: "File is broken or has no data",
          position: "top-center",
        });
        handleReset(inputRef);
      } else if (result[1].tag === "Poorly formatted CSV") {
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
        <h4>Data</h4>
        <div>
          <p className="p2 text-muted-foreground">
            Upload your data in .csv format. The file must have the following
            columns: “id” (a unique identifier for each comment) and “comment”
            (the participant's response). Optionally, include a “name” column
            for participant names; otherwise, participants will be considered
            anonymous.
          </p>
          <br />
          <p className="p2 text-muted-foreground">
            You can download a{" "}
            <a
              className="underline"
              href="https://docs.google.com/spreadsheets/d/1k8L1M9Ptxz_fBlZlGe0f-X4wCRIfmmRrISLy3c5EqUk/edit?gid=0#gid=0"
            >
              sample CSV
            </a>{" "}
            template here to get started.
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

const FormOpenAIKey = () => {
  const { formState, register } = useFormContext();
  const { touchedFields, errors } = formState;
  return (
    <Col gap={2}>
      <label htmlFor="apiKey">
        <h4>OpenAI Key</h4>
      </label>
      <Input
        id="apiKey"
        type="password"
        placeholder="Type OpenAI key here"
        className={cn(
          "sm: w-1/2",
          touchedFields.apiKey && errors.apiKey && "border-destructive",
        )}
        required
        {...register("apiKey")}
      />
      {touchedFields.apiKey && errors.apiKey && (
        <p className="text-destructive text-sm">Add the Key</p>
      )}
    </Col>
  );
};

const CustomizePrompts = () => (
  <Col gap={8}>
    <Col gap={4}>
      <h4>Customize AI prompts</h4>
      <p className="p2 text-muted-foreground">
        Optionally you can customize our prompts we use to generate the report.
        Changing the text of prompts will influence how the report is rendered.
      </p>
    </Col>
    <CustomizePromptSection
      title="Role prompt"
      subheader="This prompt helps AI understand how to approach generating reports. It is prepended to all the steps of the report generation flow listed below."
      inputName="systemInstructions"
    />
    <CustomizePromptSection
      title="Step 1 – Topics and subtopics prompt"
      subheader="This is the first step of the report creation flow. Here AI generates common topics and subtopics and writes descriptions for each."
      inputName="clusteringInstructions"
    />
    <CustomizePromptSection
      title="Step 2 – Claim extraction prompt"
      subheader="In the second step AI takes comments of each participants and renders them against topics and subtopics from the previous step. Then it distills relevant claims and quotes. This prompt is run as many times as there are participants."
      inputName="extractionInstructions"
    />
    <CustomizePromptSection
      title="Step 3 – Merging claims prompt"
      subheader="In the last step AI merges similar claims."
      inputName="dedupInstructions"
    />
  </Col>
);

function CustomizePromptSection({
  title,
  subheader,
  inputName,
}: {
  title: string;
  subheader: string;
  inputName: string;
}) {
  const { register, formState, getValues, setValue } = useFormContext();
  const { touchedFields, errors, defaultValues } = formState;

  const showError =
    Object.hasOwn(touchedFields, inputName) && Object.hasOwn(errors, inputName);
  const changedDefault = getValues(inputName) !== defaultValues![inputName];

  return (
    <Col gap={3}>
      <Col gap={1}>
        <p className="font-medium">{title}</p>
        <p className="p2 text-muted-foreground">{subheader}</p>
      </Col>
      <TextArea
        id={inputName}
        // onChange={(e) => setFormValue(e.target.value)}
        // className={`${formValue === defaultValue ? "text-muted-foreground" : ""}`}
        className={`${!changedDefault && "text-muted-foreground"} ${showError && "border-destructive"}`}
        {...register(inputName)}
        required
      />
      {showError && <p className="text-destructive text-sm">Add the prompt</p>}
      <div>
        <Button
          variant={"outline"}
          disabled={!changedDefault}
          onClick={() =>
            setValue(inputName, defaultValues![inputName], {
              shouldValidate: true,
              shouldTouch: true,
            })
          }
          type="button"
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
        <p className="text-muted-foreground">
          This estimate is based on [XXX]. Typically, our real cost vary between
          by 10-15% up or down. A general guideline is that 1 MB costs
          approximately $24, so 0.5 MB would be around $12, and 10 MB about
          $120.
        </p>
      </Col>
    </Col>
  );
}