"use client";

import React from "react";
import { useFormStatus } from "react-dom";
import { GenerateApiResponse } from "tttc-common/api";

function FormLoading() {
  return (
    <div>
      <p>We're processing your report. This may take a minute.</p>
    </div>
  );
}

async function ResponseUI({ response }: { response: GenerateApiResponse }) {
  const { url, filename } = response;
  return (
    <div>
      <text>Your report is being prepared at </text>{" "}
      <a href={url}>{filename}</a>{" "}
      <text>. Make sure to open and bookmark this link!</text>
    </div>
  );
}

export default function SubmitFormControl({
  children,
  response,
}: React.PropsWithChildren<{
  response: GenerateApiResponse | null;
}>) {
  const { pending } = useFormStatus();
  if (pending) return <FormLoading />;
  else if (response === null) return children;
  else return <ResponseUI response={response} />;
}
