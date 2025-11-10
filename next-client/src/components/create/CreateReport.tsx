"use client";
import React, { useEffect, useState, useActionState } from "react";
import * as api from "tttc-common/api";
import { Center, Col } from "@/components/layout";
import { Button, Spinner } from "@/components/elements";
import Form from "next/form";
import submitAction from "@/features/submission/actions/SubmitAction";
import { useUser } from "@/lib/hooks/getUser";
import { AsyncState, useAsyncState } from "@/lib/hooks/useAsyncState";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { fetchToken } from "@/lib/firebase/getIdToken";
import {} from "./components/FormHelpers";
import { SigninModal } from "./components/Modals";
import { useDeferredValue } from "./hooks/useDeferredValue";
import { EmailVerificationPrompt } from "@/components/auth/EmailVerificationPrompt";

import { success } from "tttc-common/functional-utils";
import { useFormState } from "./hooks/useFormState";
import {
  AdvancedSettings,
  CostEstimate,
  FormAbout,
  FormDataInput,
  FormDescription,
  FormHeader,
  TermsAndConditions,
} from "./components/FormSections";

/**
 * Hook for fetching the user's OAuth token. Needed before report form is shown.
 */
function getUserToken(): AsyncState<string | null, Error> & {
  user: ReturnType<typeof useUser>["user"];
  emailVerified: boolean;
} {
  const { user, loading, emailVerified } = useUser();

  // Only run fetchToken when loading is false and user exists
  const shouldFetch = !loading && !!user;
  const userId = user?.uid ?? null;

  const asyncState = useAsyncState(
    async () => {
      if (!shouldFetch) return success(null);
      else return await fetchToken(user);
    },
    shouldFetch ? userId : null, // Only changes when userId changes
  );

  return { ...asyncState, user, emailVerified };
}

/**
 * Binds the OAuth token to the form submission.
 */
const bindTokenToAction = <Input, Output>(
  token: string | null,
  action: (token: string | null, input: Input) => Promise<Output>,
) => {
  return async (_: api.GenerateApiResponse | null, input: Input) => {
    return action(token, input);
  };
};

const initialState: api.GenerateApiResponse | null = null;

/**
 * Root component, fetches user's token and then renders the report
 */
export default function CreateReport() {
  const { isLoading, result, user, emailVerified } = getUserToken();

  /**
   * If we haven't gotten the user's OAuth token, show the loading state
   */
  if (isLoading || result === undefined)
    return (
      <Center>
        <Spinner />
      </Center>
    );

  if (result.tag === "failure")
    return (
      <Center>
        <p>Authentication error. Please try signing in again.</p>
      </Center>
    );

  if (result.tag === "success") {
    const token = result.value;
    return (
      <CreateReportComponent
        token={token}
        user={user}
        emailVerified={emailVerified}
      />
    );
  }

  return (
    <Center>
      <p>Unable to load create report</p>
    </Center>
  );
}

/**
 * Component for user to submit requests to create reports
 */
function CreateReportComponent({
  token,
  user,
  emailVerified,
}: {
  token: string | null;
  user: ReturnType<typeof useUser>["user"];
  emailVerified: boolean;
}) {
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

  const {
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
  } = useFormState();

  // Check if user is signed in with email/password (not Google)
  // Google sign-ins are automatically verified
  const isEmailPasswordUser =
    user?.providerData.some((provider) => provider.providerId === "password") ??
    false;
  const needsEmailVerification = isEmailPasswordUser && !emailVerified;

  const isDisabled = isFormInvalid(files, token) || needsEmailVerification;

  return (
    <>
      <SigninModal isOpen={modalOpen} />
      <Form action={formAction}>
        <SubmitFormControl response={state}>
          <Col gap={8} className="mb-20">
            <h3>Create a report</h3>
            <FormHeader />
            <FormAbout />
            {needsEmailVerification && (
              <EmailVerificationPrompt userEmail={user?.email ?? null} />
            )}
            <FormDescription title={title} description={description} />
            <FormDataInput files={files} setFiles={setFiles} />
            {/* <CostEstimate files={files} /> */}
            <TermsAndConditions />
            <AdvancedSettings
              systemInstructions={systemInstructions}
              clusteringInstructions={clusteringInstructions}
              extractionInstructions={extractionInstructions}
              dedupInstructions={dedupInstructions}
              summariesInstructions={summariesInstructions}
              cruxInstructions={cruxInstructions}
              cruxesEnabled={cruxesEnabled}
              bridgingEnabled={bridgingEnabled}
            />
            <div>
              <Button size={"sm"} type="submit" disabled={isDisabled}>
                Generate the report
              </Button>
            </div>
            <br />
          </Col>
        </SubmitFormControl>
      </Form>
    </>
  );
}

/**
 * Shows when the form is submitted and in loading state
 */
function FormLoading() {
  return (
    <Col gap={2} className="w-full h-full items-center justify-center">
      <p>Processing your request, you'll be redirected shortly.</p>
      <Spinner />
    </Col>
  );
}

/**
 * Checks the url in the response object. If its present, redirect to that report
 */
function SubmitFormControl({
  children,
  response,
}: React.PropsWithChildren<{ response: api.GenerateApiResponse | null }>) {
  const { pending } = useFormStatus();
  const router = useRouter();
  useEffect(() => {
    if (response !== null) {
      const url =
        response.reportUrl || `/report/${encodeURIComponent(response.jsonUrl)}`;
      router.replace(url);
    }
  }, [response]);

  if (pending) {
    return <FormLoading />;
  }

  return <>{children}</>;
}
