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
} from "../elements";
import { Input } from "../elements";
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
import { useUser } from "@src/lib/hooks/getUser";
import { useAsyncState } from "@src/lib/hooks/useAsyncState";
import { User } from "firebase/auth";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { signInWithGoogle } from "@src/lib/firebase/auth";

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
    },
  });

  const isDisabled = !files?.item(0) || !methods.formState.isValid || !token;
  console.log("first,", !files?.item(0));
  console.log("second, ", !methods.formState.isValid);
  console.log("third", !token);

  return (
    <FormProvider {...methods}>
      <SigninModal isOpen={modalOpen} />
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
    <h3>Create a Report</h3>
    <p>
      Authentication: To create your own Talk to the City (T3C) report, you'll
      need 0) to sign in first, 1) your unstructured text data as a CSV file and
      2) your own OpenAI API key. We send your data to OpenAI’s API for
      processing into a report which we then store for you on this website.
    </p>
    <p>
      Give your report a title and description below, upload your CSV file, and
      copy & paste your OpenAI API key. We send this key and the text in your
      CSV file to OpenAI in a 3-step AI pipeline, extracting key claims and
      topics. You can optionally customize the prompts we use for each step of
      the pipeline, e.g. to focus on particular questions, themes, or
      perspectives in your data.{" "}
    </p>
    <p>
      Click "Generate the report" to start the pipeline. This may take a few
      minutes, especially for longer reports — consider trying a smaller portion
      of your dataset first, around 10-20 rows.
    </p>
    <p>
      **Note**: We do not store your OpenAI API keys. We encourage care &
      discretion when sending any sensitive/personally-identifiable info in the
      text. Once you create a report, it is publicly viewable at a unique URL
      (we’re adding password-protected & private reports soon).
    </p>
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
        <h4>Input data (as CSV file)</h4>
        <div>
          <p className="p2 text-muted-foreground">
            Upload your data in .csv format. The file must have the following
            columns: “id” (a unique identifier for each comment) and “comment”
            (the participant's response). Optionally, include an “interview”
            column for participant names; otherwise, participants will be
            considered anonymous.
          </p>
          <br />
          <p className="p2 text-muted-foreground">
            You can download a{" "}
            <a
              className="underline"
              target="_blank"
              href="https://docs.google.com/spreadsheets/d/15cKedZ-AYPWMJoVFJY6ge9jUEnx1Hu9MHnhQ_E_Z4FA/edit"
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
        <h4>OpenAI API Key</h4>
      </label>
      <Input
        id="apiKey"
        type="password"
        placeholder="Type OpenAI key here"
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

const CustomizePrompts = () => (
  <Col gap={8}>
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
      <h4>Preliminary Terms of Service</h4>
      <p>
        By accessing the Talk to the City (T3C) report creation feature, users
        must comply with the following requirements:
      </p>
      <p>
        Authentication: Users must be signed into their account prior to report
        generation.
      </p>
      <p>
        Data Processing: Upon submission, your data will be transmitted to
        OpenAI's API for processing and subsequent storage on our platform.
        Users maintain responsibility for the data they submit.
      </p>
      <p>
        Important Disclosures:
        <li>
          OpenAI API keys are processed securely and are not retained in our
          systems
        </li>
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
      </p>
      <p>
        By proceeding with report generation, users acknowledge and accept these
        terms and conditions.
      </p>
    </Col>
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
