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
  const { jsonUrl, reportUrl, filename } = response;
  return (
    <div>
      {/* <text>Your submission is being processed</text>
      <text>
        You will be able to find your JSON data here:{" "}
        <a href={jsonUrl}>{filename}</a>
      </text>
      <br />
      <text>
        After your data has been processed, you'll be able to see your report by
        following <a href={reportUrl}>this link</a>.
      </text>
      <br />
      <text>Make sure to open and bookmark these links!</text> */}
      <text>
        <a href={reportUrl}>Url</a>
      </text>
      <text>
        <a href={jsonUrl}>GCloud</a>
      </text>
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
