"use client";

import React from "react";
import { useFormStatus } from "react-dom";

function FormLoading() {
  return (
    <div>
      <p>We're processing your report. This may take a minute.</p>
    </div>
  );
}

export default function SubmitFormControl({
  children,
}: React.PropsWithChildren) {
  const { pending } = useFormStatus();
  return pending ? <FormLoading /> : children;
}
