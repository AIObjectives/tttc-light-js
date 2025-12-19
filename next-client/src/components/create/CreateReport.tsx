"use client";
import type { User } from "firebase/auth";
import { AlertCircle } from "lucide-react";
import Form from "next/form";
import { useRouter } from "next/navigation";
import type React from "react";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import type * as api from "tttc-common/api";
import { logger } from "tttc-common/logger/browser";
import { EmailVerificationPrompt } from "@/components/auth/EmailVerificationPrompt";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Spinner,
} from "@/components/elements";
import { Center, Col } from "@/components/layout";
import submitAction from "@/features/submission/actions/SubmitAction";
import { useUser } from "@/lib/hooks/getUser";
import {
  AdvancedSettings,
  CostEstimate,
  FormAbout,
  FormDataInput,
  FormDescription,
  FormHeader,
  TermsAndConditions,
} from "./components/FormSections";
import { SigninModal } from "./components/Modals";
import { SubmissionErrorBanner } from "./components/SubmissionErrorBanner";
import { useFormState } from "./hooks/useFormState";
import { useSignInModal } from "./hooks/useSignInModal";
import { useSubmitValidation } from "./hooks/useSubmitValidation";

const createReportLogger = logger.child({ module: "create-report" });

/** Check if user needs email verification (email/password users only, not Google) */
function checkNeedsEmailVerification(
  user: ReturnType<typeof useUser>["user"],
  emailVerified: boolean,
): boolean {
  const isEmailPasswordUser =
    user?.providerData.some((provider) => provider.providerId === "password") ??
    false;
  return isEmailPasswordUser && !emailVerified;
}

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

/** Check if user signed up with email/password (not OAuth like Google) */
function isEmailPasswordUser(user: User | null): boolean {
  return (
    user?.providerData.some((provider) => provider.providerId === "password") ??
    false
  );
}

/**
 * Binds the user to the form submission, fetching a fresh token at submit time.
 * This prevents stale token issues when users spend a long time editing the form.
 *
 * For email/password users, we force a token refresh to ensure the server gets
 * the latest email_verified claim. This is necessary because the client's
 * user.emailVerified state can be updated (e.g., after clicking verification link)
 * while the cached JWT token still has email_verified: false.
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
        // Force refresh for email/password users to get updated email_verified claim
        // OAuth users (Google, etc.) don't need this since their email is pre-verified
        const forceRefresh = isEmailPasswordUser(user);
        token = await user.getIdToken(forceRefresh);
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
  const submitActionWithUser = bindTokenToAction(user, submitAction);
  const [state, formAction] = useActionState(
    submitActionWithUser,
    initialState,
  );
  const [files, setFiles] = useState<FileList | undefined>(undefined);

  const formState = useFormState();
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
  } = formState;

  const { submitAttempted, errorCount, handleSubmit } = useSubmitValidation(
    formState,
    files,
  );

  const { modalOpen, handleAuthError } = useSignInModal(user);
  const needsEmailVerification = checkNeedsEmailVerification(
    user,
    emailVerified,
  );
  const isDisabled = !user || needsEmailVerification;

  return (
    <>
      <SigninModal isOpen={modalOpen} />
      <Form action={formAction} onSubmit={handleSubmit} noValidate>
        <SubmitFormControl response={state} onAuthError={handleAuthError}>
          <Col gap={8} className="mb-20">
            <h3>Create a report</h3>
            {needsEmailVerification && (
              <EmailVerificationPrompt userEmail={user?.email ?? null} />
            )}
            <FormHeader />
            <FormAbout />
            <FormDescription
              title={title}
              description={description}
              showErrors={submitAttempted}
            />
            <FormDataInput
              files={files}
              setFiles={setFiles}
              showErrors={submitAttempted}
            />
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
            {submitAttempted && errorCount > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  You need to fix {errorCount} error{errorCount > 1 ? "s" : ""}{" "}
                  above before continuing
                </AlertDescription>
              </Alert>
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
