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
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Spinner,
  TextArea,
  Separator,
} from "../elements";
import { Input } from "../elements";
import Icons from "@/assets/icons";
import { useCostEstimate } from "./hooks/useCostEstimate";
import { useReactiveValue } from "@/lib/hooks/useReactiveValue";
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
import submitAction from "@/features/submission/actions/SubmitAction";
import { z } from "zod";
import { useForm, FormProvider, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils/shadcn";
import * as prompts from "tttc-common/prompts";
import { useUser } from "@/lib/hooks/getUser";
import { useAsyncState } from "@/lib/hooks/useAsyncState";
import { User } from "firebase/auth";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { signInWithGoogle } from "@/lib/firebase/auth";
import { crux } from "tttc-common/schema";

const fetchToken = async (
  user: User | null,
): Promise<["data", string | null] | ["error", string]> => {
  try {
    if (!user) return ["data", null];
    return ["data", await user?.getIdToken()];
  } catch (e) {
    return ["error", e instanceof Error ? e.message : "An error occured"];
  }
};

function getUserToken() {
  const user = useUser();
  return useAsyncState(() => fetchToken(user), user);
}

const bindTokenToAction = <Input, Output>(
  token: string | null,
  action: (token: string | null, input: Input) => Promise<Output>,
) => {
  return async (_: api.GenerateApiResponse | null, input: Input) => {
    return action(token, input);
  };
};

const initialState: api.GenerateApiResponse | null = null;

// !!! This is copied from schema.LLMUserConfig. For some reason its resulting in an infinite cycle with useForm. Figure this out later.
const form = z.object({
  // apiKey: z.string().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  systemInstructions: z.string().min(1),
  clusteringInstructions: z.string().min(1),
  extractionInstructions: z.string().min(1),
  dedupInstructions: z.string().min(1),
  cruxInstructions: z.string().optional(),
  cruxesEnabled: z.boolean().optional().nullish().transform((val) => val ?? false)
});

function Center({ children }: React.PropsWithChildren) {
  return (
    <div className="w-full h-full content-center justify-items-center">
      {children}
    </div>
  );
}

export default function CreateReport() {
  const { isLoading, result } = getUserToken();

  if (result === undefined || isLoading)
    return (
      <Center>
        <Spinner />
      </Center>
    );
  else if (result[0] === "error")
    return (
      <Center>
        <p>An error occured...</p>
      </Center>
    );
  else return <CreateReportComponent token={result[1]} />;
}

const SigninModal = ({ isOpen }: { isOpen: boolean }) => {
  return (
    <Dialog open={isOpen}>
      <DialogContent className="gap-10">
        <DialogHeader>
          <DialogTitle>Login to create a report</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          <Button onClick={signInWithGoogle}>Login</Button>
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
};

const useDeferredValue = <T,>(value: T, delay = 1000): T | "deferred" => {
  const [deferredValue, setDeferredValue] = useState<T | "deferred">(
    "deferred",
  );

  useEffect(() => {
    // Set up the timer to check the value after the specified delay
    const timer = setTimeout(() => {
      setDeferredValue(value);
    }, delay);

    // Clean up the timer if the component unmounts or value changes
    return () => clearTimeout(timer);
  }, [value, delay]);

  return deferredValue;
};

function CreateReportComponent({ token }: { token: string | null }) {
  const [modalOpen, setModalOpen] = useState(false);
  const submitActionWithToken = bindTokenToAction(token, submitAction);
  const [state, formAction] = useActionState(
    submitActionWithToken,
    initialState,
  );
  const [files, setFiles] = useState<FileList | undefined>(undefined);

  const deferredToken = useDeferredValue(token);

  useEffect(() => {
    if (deferredToken === "deferred") {
      setModalOpen(false);
    } else if (deferredToken === null) {
      setModalOpen(true);
    } else {
      setModalOpen(false);
    }
  }, [deferredToken]);

  const methods = useForm<z.infer<typeof form>>({
    resolver: zodResolver(form),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      title: "",
      description: "",
      // apiKey: "placeholder",
      systemInstructions: prompts.defaultSystemPrompt,
      clusteringInstructions: prompts.defaultClusteringPrompt,
      extractionInstructions: prompts.defaultExtractionPrompt,
      dedupInstructions: prompts.defaultDedupPrompt,
      cruxInstructions: prompts.defaultCruxPrompt,
      cruxesEnabled: false,
    },
  });

  // ! Brandon: For some reason I can't get the form to revalidate
  // ! But when I watch / console log  it, it works.
  // ! I'm going to leave this in a as a hotfix and focus on fixing the real bug
  // ! When this component is refactored
  const title = methods.watch("title");
  const description = methods.watch("description");
  useEffect(() => {
    console.log(methods.formState.isValid);
  }, [title, description]);

  const isDisabled = !files?.item(0) || !methods.formState.isValid || !token;

  return (
    <FormProvider {...methods}>
      <SigninModal isOpen={modalOpen} />
      <Form action={formAction}>
        <SubmitFormControl response={state}>
          <Col gap={8} className="mb-20">
            <FormHeader />
            <FormDescription />
            <FormDataInput files={files} setFiles={setFiles} />
            <CostEstimate files={files} />
            <AdvancedSettings />
            <div>
              <Button size={"sm"} type="submit" disabled={isDisabled}>
                Generate the report
              </Button>
            </div>
            <TermsAndConditions />
            <br />
          </Col>
        </SubmitFormControl>
      </Form>
    </FormProvider>
  );
}

const FormHeader = () => (
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

const FormDescription = () => {
  const { register, formState } = useFormContext();
  const { touchedFields, errors } = formState;
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
            We detected a poorly formatted csv. Do you want to proceed?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Please make sure the CSV contains at least two columns named "id"
            and "comment"
          </AlertDialogDescription>
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
    if (!result) return;
    else if (result[0] === "error") {
      if (result[1].tag === "Broken file" || result[1].tag === "Size Error") {
        const description =
          result[1].tag === "Broken file"
            ? "File is broken or has no data"
            : "File is too large - 150kb limit";
        toast.error("Error", {
          description: description,
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

const FormOpenAIKey = () => {
  const { formState, register } = useFormContext();
  const { touchedFields, errors } = formState;
  return (
    <Col gap={2}>
      <label htmlFor="apiKey">
        <h4>OpenAI API Key</h4>
      </label>
      <div>
        <p className="p2 text-muted-foreground">
          Launching soon: use your own OpenAI key to analyze large datasets. We
          will not store your OpenAI API keys, or use them for any purposes
          beyond generating this report; API keys are sent through encrypted
          channels in our app.
        </p>
      </div>
      <Input
        id="apiKey"
        type="password"
        placeholder="Paste OpenAI API key here"
        className={cn(
          "sm: w-1/2",
          touchedFields.apiKey && errors.apiKey && "border-destructive",
        )}
        // required
        disabled
        // {...register("apiKey")}
      />
      {touchedFields.apiKey && errors.apiKey && (
        <p className="text-destructive text-sm">Add the Key</p>
      )}
    </Col>
  );
};

const CustomizePrompts = ({ show }: { show: boolean }) => (
  <Col gap={8} className={show ? "" : "hidden"}>
    <EnableResearchFeatures/>
    <Col gap={4}>
      <h4>Customize AI prompts</h4>
      <p className="p2 text-muted-foreground">
        Optionally customize the prompts we use to generate the report, e.g. to
        focus on specific questions, topics, or perspectives. Changing these the
        prompts will change the resulting report.
      </p>
    </Col>
    <CustomizePromptSection
      title="Role prompt for all steps"
      subheader="This prompt helps AI understand how to approach generating reports. It is prepended to all the steps of the report generation flow shown below."
      inputName="systemInstructions"
    />
    <CustomizePromptSection
      title="Step 1 – Topics and subtopics prompt"
      subheader="In the first step, the AI finds the most frequent topics and subtopics mentioned in the comments and writes short descriptions for each."
      inputName="clusteringInstructions"
    />
    <CustomizePromptSection
      title="Step 2 – Claim extraction prompt"
      subheader="In the second step, the AI summarizes each particpant's comments as key claims with supporting quotes from the original text.
      It then assigns the claim to the most relevant subtopic in the report. This prompt runs once for each participant's comment"
      inputName="extractionInstructions"
    />
    <CustomizePromptSection
      title="Step 3 – Merging claims prompt"
      subheader="In the last step, AI collects very similar or near-duplicate statements under one representative claim"
      inputName="dedupInstructions"
    />
    <CustomizePromptSection
      title="Optional – Suggest crux summary statements of opposing perspectives"
      subheader="In this optional research step, AI suggests pairs of 'crux' statements which would best split participants into agree/disagree groups or sides of about equal size"
      inputName="cruxInstructions"
    />
  </Col>
);

function AdvancedSettings() {
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
      <CustomizePrompts show={show} />
      <div className={show ? "block" : "hidden"}>
        <Button
          variant={"secondary"}
          type="button"
          onClick={() => setShow((curr) => !curr)}
        >
          Hide advanced settings
        </Button>
      </div>
    </Col>
  );
}

const EnableResearchFeatures = () => {
  const [areCruxesEnabled, setCruxesEnabled] = React.useState(false);
  const handleChange = (event) => {
    setCruxesEnabled((areCruxesEnabled) => !areCruxesEnabled);
  };
  return (
    <Col gap={4}>
      <h4>Enable Research Features</h4>
      <Col gap={2}>
        <Col>
          <label htmlFor="title" className="font-medium">
            Extract likely crux statements
          </label>
          <p className="p2 text-muted-foreground">
            As an extra processing step, suggest pairs of
            perspective-summarizing statements which would best split the
            respondents (into agree/disagree sides/groups of about equal size).
            This optional step increases processing costs and will only be run if you
            check this box. Results are available in the JSON download at
            the end of a report.
          </p>
          <div style={{ margin: "8px 0" }}>
            <input
              type="checkbox"
              checked={areCruxesEnabled}
              onChange={handleChange}
            />
            <label style={{ paddingLeft: "8px" }}>
              Suggest top crux pairs
            </label>
          </div>
        </Col>
      </Col>
    </Col>
  );
};

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
          This estimate is based on past reports. Typically, our real cost vary
          between by 10-15% up or down. A general guideline is that 1 MB costs
          approximately $24, so 0.5 MB would be around $12, and 10 MB about
          $240.
        </p>
      </Col>
    </Col>
  );
}

function TermsAndConditions() {
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

function FormLoading() {
  return (
    <Col gap={2} className="w-full h-full items-center justify-center">
      <p>Processing your request, you'll be redirected shortly.</p>
      <Spinner />
    </Col>
  );
}

function SubmitFormControl({
  children,
  response,
}: React.PropsWithChildren<{ response: api.GenerateApiResponse | null }>) {
  const { pending } = useFormStatus();
  const router = useRouter();
  useEffect(() => {
    if (response !== null) {
      router.push(`/report/${encodeURIComponent(response.jsonUrl)}`);
    }
  }, [response]);
  if (pending) return <FormLoading />;
  else return children;
}
