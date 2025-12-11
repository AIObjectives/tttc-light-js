"use client";
import React, { useEffect, useState, useActionState } from "react";
import * as api from "tttc-common/api";
import { Center, Col } from "@/components/layout";
import { Button, Spinner } from "@/components/elements";
import Form from "next/form";
import submitAction from "@/features/submission/actions/SubmitAction";
import { useUser } from "@/lib/hooks/getUser";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { SigninModal } from "./components/Modals";
import { useDeferredValue } from "./hooks/useDeferredValue";
import { EmailVerificationPrompt } from "@/components/auth/EmailVerificationPrompt";
import { SubmissionErrorBanner } from "./components/SubmissionErrorBanner";
import { toast } from "sonner";

import { useFormState } from "./hooks/useFormState";
import { User } from "firebase/auth";
import { logger } from "tttc-common/logger/browser";
import {
  AdvancedSettings,
  CostEstimate,
  FormAbout,
  FormDataInput,
  FormDescription,
  FormHeader,
  TermsAndConditions,
} from "./components/FormSections";

const createReportLogger = logger.child({ module: "create-report" });

/**
 * Hook for getting the authenticated user state.
 * Token is fetched fresh at submission time, not at component mount.
 */
function useAuthState(): {
  user: ReturnType<typeof useUser>["user"];
  emailVerified: boolean;
  isLoading: boolean;
} {
  const { user, loading, emailVerified } = useUser();
  return { user, emailVerified, isLoading: loading };
}

/**
 * Binds the user to the form submission, fetching a fresh token at submit time.
 * This prevents stale token issues when users spend a long time editing the form.
 */
const bindTokenToAction = (
  user: User | null,
  action: (
    token: string | null,
    input: FormData,
  ) => Promise<api.CreateReportActionResult>,
) => {
  return async (
    _: api.CreateReportActionResult,
    input: FormData,
  ): Promise<api.CreateReportActionResult> => {
    let token: string | null = null;
    if (user) {
      try {
        // Fetch fresh token at submit time - Firebase automatically refreshes if expired
        token = await user.getIdToken();
      } catch (error) {
        createReportLogger.error({ error }, "Failed to refresh auth token");
        throw new Error("Authentication error. Please try signing in again.");
      }
    }
    return action(token, input);
  };
};

const initialState: api.CreateReportActionResult = { status: "idle" };

/**
 * Root component, checks auth state before rendering the report form
 */
export default function CreateReport() {
  const { isLoading, user, emailVerified } = useAuthState();

  /**
   * Show loading state while checking auth
   */
  if (isLoading)
    return (
      <Center>
        <Spinner />
      </Center>
    );

  return <CreateReportComponent user={user} emailVerified={emailVerified} />;
}

/**
 * Component for user to submit requests to create reports
 */
function CreateReportComponent({
  user,
  emailVerified,
}: {
  user: ReturnType<typeof useUser>["user"];
  emailVerified: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const submitActionWithUser = bindTokenToAction(user, submitAction);
  const [state, formAction] = useActionState(
    submitActionWithUser,
    initialState,
  );
  const [files, setFiles] = useState<FileList | undefined>(undefined);

  // Use deferred value to avoid showing sign-in modal immediately on page load
  const deferredUser = useDeferredValue(user);

  useEffect(() => {
    if (deferredUser === "deferred") {
      setModalOpen(false);
    } else if (deferredUser === null) {
      setModalOpen(true);
    } else {
      setModalOpen(false);
    }
  }, [deferredUser]);

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

  const isDisabled = isFormInvalid(files, user) || needsEmailVerification;

  // Handle auth errors by showing sign-in modal
  const handleAuthError = () => {
    setModalOpen(true);
  };

  return (
    <>
      <SigninModal isOpen={modalOpen} />
      <Form action={formAction}>
        <SubmitFormControl response={state} onAuthError={handleAuthError}>
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
            {/* Show inline error banner for non-auth errors */}
            {state.status === "error" &&
              !state.error.code.startsWith("AUTH_") && (
                <SubmissionErrorBanner error={state.error} />
              )}
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
 * Checks the url in the response object. If its present, redirect to that report.
 * Handles auth errors by showing toast and triggering sign-in modal.
 */
function SubmitFormControl({
  children,
  response,
  onAuthError,
}: React.PropsWithChildren<{
  response: api.CreateReportActionResult;
  onAuthError?: () => void;
}>) {
  const { pending } = useFormStatus();
  const router = useRouter();

  useEffect(() => {
    // Handle success - redirect to report
    if (response.status === "success") {
      const url =
        response.data.reportUrl ||
        `/report/${encodeURIComponent(response.data.jsonUrl)}`;
      router.replace(url);
    }

    // Handle auth errors - show toast and trigger sign-in modal
    if (
      response.status === "error" &&
      response.error.code.startsWith("AUTH_")
    ) {
      toast.error(response.error.message);
      onAuthError?.();
    }
  }, [response, router, onAuthError]);

  if (pending) {
    return <FormLoading />;
  }

  return <>{children}</>;
}
